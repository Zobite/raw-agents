/**
 * ai.ws.ts — WebSocket AI streaming handler
 *
 * Xử lý AI streaming qua WebSocket — bidirectional, không cần multi-step HTTP.
 *
 * Flow:
 *   Client ──ai:start──► Server: bắt đầu streaming
 *   Server ──ai:chunk──► Client: text delta
 *   Server ──ai:tool-call──► Client: AI muốn gọi tool
 *   Client ──ai:tool-result──► Server: kết quả tool từ FE
 *   Server tiếp tục stream với tool result
 *   Server ──ai:done──► Client: hoàn thành
 *   Server ──ai:error──► Client: lỗi
 *
 * Server chỉ đóng vai trò relay:
 *   - Lấy API key từ DB
 *   - Gửi tool-call events xuống client (FE-only tools, không có execute)
 *   - Nhận tool-result từ client và tiếp tục vòng lặp AI
 *   - Server builtins (fetch_webpage) vẫn execute server-side như bình thường
 *
 * LangGraph JS version — uses createReactAgent from @langchain/langgraph/prebuilt
 */

import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { wsHub } from "../../common/ws/wsHub.js";
import { getChatModel } from "../../common/ai/getChatModel.js";
import { BUILTIN_REGISTRY, getToolLabel } from "../../common/ai/tools/resolveTools.js";

interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AiStartPayload {
  sessionId: string;    // unique per conversation turn, for correlating tool-result replies
  providerId: string;
  modelId: string;
  systemPrompt?: string;
  messages: Record<string, unknown>[];
  toolSchemas?: ToolSchema[];
  maxSteps?: number;
}

export interface AiToolResultPayload {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
}

// ── Per-session state: pending tool-call resolvers ────────────────────────────
// When a FE tool is called, we pause the agentic loop and wait for client to resolve it.
const pendingToolResolvers = new Map<string, Map<string, (result: unknown) => void>>();

/**
 * Build a zod schema from a JSON Schema object (for FE-only tools).
 */
function buildZodFromJsonSchema(jsonSchema: Record<string, unknown>): z.ZodType {
  const props = (jsonSchema?.properties ?? {}) as Record<
    string,
    { type?: string; description?: string }
  >;
  const required = (jsonSchema?.required ?? []) as string[];
  const shape: Record<string, z.ZodType> = {};

  for (const [key, def] of Object.entries(props)) {
    let field: z.ZodType;
    switch (def.type) {
      case "number":
      case "integer":
        field = z.number();
        break;
      case "boolean":
        field = z.boolean();
        break;
      case "array":
        field = z.array(z.unknown());
        break;
      case "object":
        field = z.object({}).passthrough();
        break;
      default:
        field = z.string();
    }
    if (def.description) field = field.describe(def.description);
    if (!required.includes(key)) {
      field = field.optional() as z.ZodType;
    }
    shape[key] = field;
  }

  return z.object(shape);
}

/**
 * Handle ai:start — begins a streaming session for this clientId.
 */
export async function handleAiStart(clientId: string, payload: AiStartPayload) {
  const {
    sessionId,
    providerId,
    modelId,
    systemPrompt = "",
    messages,
    toolSchemas = [],
    maxSteps = 12,
  } = payload;

  // Track resolvers for this session
  const resolvers = new Map<string, (result: unknown) => void>();
  pendingToolResolvers.set(sessionId, resolvers);

  const send = (type: "ai:chunk" | "ai:tool-call" | "ai:tool-result" | "ai:done" | "ai:error", data: unknown) => {
    wsHub.send(clientId, type as any, data);
  };

  try {
    // 1. Resolve model (API key from DB)
    const model = await getChatModel(providerId, modelId);

    // 2. Build tools array
    //    - Server builtins: real execute (fetch_webpage, etc.)
    //    - FE-only tools: wait for client to send ai:tool-result via WebSocket
    const tools: StructuredToolInterface[] = [];

    for (const ts of toolSchemas) {
      if (ts.name in BUILTIN_REGISTRY) {
        tools.push(BUILTIN_REGISTRY[ts.name]);
      } else {
        // FE-only tool: send tool-call to client, wait for result via Promise
        const schema = buildZodFromJsonSchema(ts.inputSchema);
        const feToolName = ts.name;
        const feToolDesc = ts.description;

        tools.push(
          tool(
            async (input: unknown) => {
              const toolCallId = crypto.randomUUID();

              // Ask client to execute the tool
              send("ai:tool-call", {
                sessionId,
                toolCallId,
                toolName: feToolName,
                toolLabel: getToolLabel(feToolName),
                input,
              });

              // Wait (up to 30s) for client to send back ai:tool-result
              const result = await new Promise<unknown>((resolve) => {
                const timeoutId = setTimeout(() => {
                  resolvers.delete(toolCallId);
                  resolve(JSON.stringify({ error: "Tool execution timeout after 30s" }));
                }, 30_000);

                resolvers.set(toolCallId, (result) => {
                  clearTimeout(timeoutId);
                  resolvers.delete(toolCallId);
                  resolve(typeof result === "string" ? result : JSON.stringify(result));
                });
              });

              return result as string;
            },
            {
              name: feToolName,
              description: feToolDesc,
              schema,
            },
          ),
        );
      }
    }

    // 3. Build agent
    const reactAgent = createReactAgent({
      llm: model,
      tools,
    });

    // Convert messages to BaseMessage[]
    const baseMessages: BaseMessage[] = [];
    if (systemPrompt) {
      baseMessages.push(new SystemMessage(systemPrompt));
    }
    for (const msg of messages) {
      const role = msg.role as string;
      const content = msg.content as string;
      if (role === "user") baseMessages.push(new HumanMessage(content));
      else if (role === "assistant") baseMessages.push(new AIMessage(content));
      else if (role === "system") baseMessages.push(new SystemMessage(content));
    }

    // 4. Stream
    const stream = await reactAgent.stream(
      { messages: baseMessages },
      {
        recursionLimit: maxSteps * 2 + 1,
        streamMode: ["messages", "updates"] as any,
      },
    );

    let fullText = "";
    const emittedToolCalls = new Set<string>();

    for await (const chunk of stream) {
      const [mode, data] = chunk as unknown as [string, any];

      if (mode === "messages") {
        const [msgChunk] = data as [any, any];
        const msgType = msgChunk?._getType?.() ?? msgChunk?.type;

        if (msgType === "ai" || msgType === "AIMessageChunk") {
          const content = msgChunk?.content;
          if (typeof content === "string" && content) {
            fullText += content;
            send("ai:chunk", { sessionId, text: content });
          }

          // Tool calls from AI
          if (msgChunk?.tool_call_chunks) {
            for (const tc of msgChunk.tool_call_chunks) {
              if (tc.name && tc.id && !emittedToolCalls.has(tc.id)) {
                emittedToolCalls.add(tc.id);
                // For server builtins, emit tool-call for UI display
                if (tc.name in BUILTIN_REGISTRY) {
                  send("ai:tool-call", {
                    sessionId,
                    toolCallId: tc.id,
                    toolName: tc.name,
                    toolLabel: getToolLabel(tc.name),
                    input: tc.args ? (() => { try { return JSON.parse(tc.args); } catch { return tc.args; } })() : {},
                  });
                }
                // FE tools are handled in their execute() function above
              }
            }
          }
        } else if (msgType === "tool" || msgType === "ToolMessage" || msgType === "ToolMessageChunk") {
          // Tool results — for UI display
          const toolName = msgChunk?.name ?? "unknown";
          const rawContent = msgChunk?.content;
          const result = typeof rawContent === "string"
            ? (() => { try { return JSON.parse(rawContent); } catch { return rawContent; } })()
            : rawContent;
          send("ai:tool-result", {
            sessionId,
            toolCallId: msgChunk?.tool_call_id,
            toolName,
            result,
          });
        }
      } else if (mode === "updates") {
        // Capture tool calls from updates mode as fallback
        for (const [nodeName, state] of Object.entries(data as Record<string, any>)) {
          if (nodeName === "agent" && state?.messages) {
            for (const msg of state.messages) {
              if (msg?.tool_calls && Array.isArray(msg.tool_calls)) {
                for (const tc of msg.tool_calls) {
                  const tcId = tc.id ?? `${tc.name}-${Date.now()}`;
                  if (!emittedToolCalls.has(tcId) && tc.name in BUILTIN_REGISTRY) {
                    emittedToolCalls.add(tcId);
                    send("ai:tool-call", {
                      sessionId,
                      toolCallId: tcId,
                      toolName: tc.name,
                      toolLabel: getToolLabel(tc.name),
                      input: tc.args,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!fullText) {
      fullText = "";
    }

    send("ai:done", { sessionId, text: fullText });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("AbortError") && msg !== "AbortError") {
      send("ai:error", { sessionId, error: msg });
    }
  } finally {
    pendingToolResolvers.delete(sessionId);
  }
}

/**
 * Handle ai:tool-result — client has executed a FE tool and sends back the result.
 * Resolves the pending Promise in the tool's execute function so the agent can continue.
 */
export function handleAiToolResult(payload: AiToolResultPayload) {
  const { sessionId, toolCallId, result } = payload;
  const resolvers = pendingToolResolvers.get(sessionId);
  if (!resolvers) return;
  const resolve = resolvers.get(toolCallId);
  if (resolve) resolve(result);
}
