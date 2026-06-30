/**
 * useChatAgent.ts
 *
 * AI chat via WebSocket — bidirectional, single connection.
 *
 * Flow per conversation turn:
 *   1. Client sends ai:start → server begins streamText
 *   2. Server sends ai:chunk (text), ai:tool-call (FE tool needed)
 *   3. Client executes FE tool locally → sends ai:tool-result
 *   4. Server resolves Promise, continues streamText → back to step 2
 *   5. Server sends ai:done when finished
 *
 * FE tool execution:
 *   - update_editor_code: tool.execute() returns { ok: true }, onToolAction updates editor UI
 *   - run_current_script: tool.execute() calls /api/tools/run-code → real Python output
 *   - fetch_webpage: server builtin — executes server-side, streams ai:tool-result
 */

import type React from "react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { ToolSet } from "src/common/types/tool";
import { wsClient } from "../../../common/api/wsClient";
import { useAppSelector } from "../../../store/store";
import { store } from "../../../store/store";
import type { ChatAgentMessage } from "./types";
import { useAutoScroll } from "./useAutoScroll";
import { formatToolName, nextId } from "./utils";

// ── Status type ───────────────────────────────────────────────────────────────
export type ChatStatus = "ready" | "submitted" | "streaming" | "done" | "error";

// ── Tool action event ─────────────────────────────────────────────────────────
export type ToolActionEvent =
  | { type: "tool-call"; toolName: string; toolLabel: string; input: unknown }
  | { type: "tool-result"; toolName: string; output: unknown };

// ── Hook options ──────────────────────────────────────────────────────────────
export interface UseChatAgentOptions {
  propProviderId?: string;
  propModel?: string;
  externalMessages: ChatAgentMessage[];
  systemPrompt?: string;
  /**
   * ToolSet — schemas sent to server so AI knows which tools exist.
   * FE-only tools: server sends ai:tool-call, client calls tool.execute() locally.
   * Server builtins: execute server-side, server sends ai:tool-result.
   */
  tools?: ToolSet;
  maxSteps?: number;
  onFinish?: (messages: ChatAgentMessage[]) => void;
  onClear?: () => void;
  onChangeAiProvider?: (id: string) => void;
  onChangeModel?: (model: string) => void;
  onToolAction?: (event: ToolActionEvent) => void;
}

// ── Hook return value ─────────────────────────────────────────────────────────
export interface UseChatAgentReturn {
  messages: ChatAgentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatAgentMessage[]>>;
  status: ChatStatus;
  generating: boolean;
  providerId: string | null;
  model: string;
  hasMessages: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef: (node: HTMLElement | null) => void;
  scrollToBottom: () => void;
  forceFollow: () => void;
  handleSend: (text: string) => Promise<void>;
  handleCancel: () => void;
  handleClear: () => void;
  handleProviderChange: (id: string) => void;
  handleModelChange: (model: string) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useChatAgent({
  propProviderId,
  propModel,
  externalMessages,
  systemPrompt = "",
  tools,
  maxSteps = 12,
  onFinish,
  onClear,
  onChangeAiProvider,
  onChangeModel,
  onToolAction,
}: UseChatAgentOptions): UseChatAgentReturn {
  const providerItems = useAppSelector((s) => s.llmProviders.items);
  const providersLoaded = useAppSelector((s) => s.llmProviders.items.length > 0 || s.llmProviders.total === 0);
  void providersLoaded; // used implicitly

  const [internalProviderId, setInternalProviderId] = useState<string | null>(propProviderId || null);
  const [internalModel, setInternalModel] = useState<string>(propModel || "");

  useEffect(() => {
    if (propProviderId) setInternalProviderId(propProviderId);
  }, [propProviderId]);
  useEffect(() => {
    if (propModel) setInternalModel(propModel);
  }, [propModel]);

  const providerId = internalProviderId;
  const model = internalModel;

  const [messages, setMessages] = useState<ChatAgentMessage[]>(externalMessages);
  const [internalStatus, setInternalStatus] = useState<ChatStatus>("ready");
  const status = internalStatus;
  const generating = status === "submitted" || status === "streaming";

  const prevExtRef = useRef<ChatAgentMessage[]>(externalMessages);
  useEffect(() => {
    if (prevExtRef.current !== externalMessages && internalStatus === "ready") {
      prevExtRef.current = externalMessages;
      setMessages(externalMessages);
    }
  }, [externalMessages, internalStatus]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  const onFinishRef = useRef(onFinish);
  const onToolActionRef = useRef(onToolAction);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    onToolActionRef.current = onToolAction;
  }, [onToolAction]);

  useEffect(() => {
    if (propProviderId) return;
    if (!providersLoaded || providerItems.length === 0) return;
    if (internalProviderId) return;
    setInternalProviderId(providerItems[0].id);
  }, [providersLoaded, providerItems, propProviderId, internalProviderId]);

  // ── Auto-scroll: callback-ref + MutationObserver, handles ALL cases ───────
  const { scrollRef: scrollContainerRef, scrollToBottom, forceFollow } = useAutoScroll();

  const hasMessages = messages.length > 0;

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setInternalStatus("ready");
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || generating) return;
      if (!internalProviderId || !model) return;

      const sessionId = crypto.randomUUID();
      cancelledRef.current = false;

      const userMsg: ChatAgentMessage = {
        id: nextId("u"),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      const assistantId = nextId("a");
      const assistantMsg: ChatAgentMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        timestamp: new Date(),
      };

      const historySnapshot = messages;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInternalStatus("submitted");

      const aiHistory = historySnapshot
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.content.trim() !== "")
        .slice(-10)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const toolSchemas = tools
        ? Object.entries(tools).map(([name, t]) => ({
            name,
            description: (t as any).description ?? "",
            inputSchema: (t as any).inputSchema?.jsonSchema ?? {},
          }))
        : [];

      const newMsgs: ChatAgentMessage[] = [userMsg, assistantMsg];
      let assistantText = "";
      let currentAssistantId = assistantId;
      let toolsStarted = false;

      // ── Subscribe to WS events for this session ───────────────────────────────
      const unsubs: (() => void)[] = [];

      const cleanup = () => {
        for (const u of unsubs) u();
      };

      await new Promise<void>((resolve) => {
        // ai:chunk — text streaming
        unsubs.push(
          wsClient.on<{ sessionId: string; text: string }>("ai:chunk", (p) => {
            if (p.sessionId !== sessionId || cancelledRef.current) return;
            setInternalStatus("streaming");

            if (toolsStarted) {
              toolsStarted = false;
              assistantText = p.text;
              const newId = nextId("a");
              currentAssistantId = newId;
              const bubble: ChatAgentMessage = {
                id: newId,
                role: "assistant",
                content: p.text,
                streaming: true,
                timestamp: new Date(),
              };
              newMsgs.push(bubble);
              setMessages((prev) => [...prev, bubble]);
            } else {
              assistantText += p.text;
              setMessages((prev) => prev.map((m) => (m.id === currentAssistantId ? { ...m, content: assistantText, streaming: true } : m)));
              const idx = newMsgs.findIndex((m) => m.id === currentAssistantId);
              if (idx !== -1) newMsgs[idx] = { ...newMsgs[idx], content: assistantText, streaming: true };
            }
          }),
        );

        // ai:tool-call — AI wants to call an FE tool
        unsubs.push(
          wsClient.on<{ sessionId: string; toolCallId: string; toolName: string; toolLabel: string; input: unknown }>("ai:tool-call", async (p) => {
            if (p.sessionId !== sessionId || cancelledRef.current) return;
            toolsStarted = true;

            // Freeze current text bubble
            if (assistantText.trim()) {
              const freezeId = currentAssistantId;
              setMessages((prev) => prev.map((m) => (m.id === freezeId ? { ...m, streaming: false } : m)));
              const idx = newMsgs.findIndex((m) => m.id === freezeId);
              if (idx !== -1) newMsgs[idx] = { ...newMsgs[idx], streaming: false };
              assistantText = "";
            }

            const toolsState = store.getState().tools;
            const rawLabel =
              p.toolLabel ||
              toolsState.builtins.find((b) => b.toolName === p.toolName)?.toolLabel ||
              (toolsState.items as any[]).find((t) => t.name === p.toolName)?.label ||
              p.toolName;
            // If label has no spaces it's still a technical name — make it readable
            const tLabel = rawLabel.includes(" ") ? rawLabel : formatToolName(rawLabel);

            const tcMsgId = nextId("tc");
            const toolMsg: ChatAgentMessage = {
              id: tcMsgId,
              role: "tool-call",
              content: p.toolName,
              toolCallId: p.toolCallId,
              toolName: p.toolName,
              toolLabel: tLabel,
              toolInput: p.input,
              timestamp: new Date(),
            };
            newMsgs.push(toolMsg);
            setMessages((prev) => [...prev, toolMsg]);
            onToolActionRef.current?.({ type: "tool-call", toolName: p.toolName, toolLabel: tLabel, input: p.input });

            // Execute the tool locally
            let result: unknown = { ok: true };
            try {
              const toolFn = tools?.[p.toolName];
              if (toolFn?.execute) {
                result = await (toolFn.execute as (input: unknown, opts: unknown) => Promise<unknown>)(p.input, {});
              }
            } catch (err) {
              result = { error: String(err) };
            }

            // Send result back to server so AI can continue
            wsClient.send("ai:tool-result", {
              sessionId,
              toolCallId: p.toolCallId,
              toolName: p.toolName,
              result,
            });

            // Update tool bubble with result immediately for UI
            const resultStr = typeof result === "string" ? result : JSON.stringify(result);
            setMessages((prev) => prev.map((m) => (m.id === tcMsgId ? { ...m, toolOutput: resultStr } : m)));
            const tcIdx = newMsgs.findIndex((m) => m.id === tcMsgId);
            if (tcIdx !== -1) newMsgs[tcIdx] = { ...newMsgs[tcIdx], toolOutput: resultStr };
            onToolActionRef.current?.({ type: "tool-result", toolName: p.toolName, output: result });
          }),
        );

        // ai:tool-result — server builtin completed (fetch_webpage etc.)
        unsubs.push(
          wsClient.on<{ sessionId: string; toolCallId?: string; toolName: string; result: unknown }>("ai:tool-result", (p) => {
            if (p.sessionId !== sessionId || cancelledRef.current) return;
            const rawOutput = p.result;
            const resultStr = typeof rawOutput === "string" ? rawOutput : JSON.stringify(rawOutput);
            setMessages((prev) => {
              // Prefer matching by toolCallId for accuracy (parallel tool calls)
              let matchIdx = -1;
              if (p.toolCallId) {
                matchIdx = prev.findIndex((m) => m.role === "tool-call" && m.toolCallId === p.toolCallId && !m.toolOutput);
              }
              // Fallback: match by toolName (last unresolved)
              if (matchIdx === -1) {
                const revIdx = [...prev].reverse().findIndex((m) => m.role === "tool-call" && m.toolName === p.toolName && !m.toolOutput);
                matchIdx = revIdx === -1 ? -1 : prev.length - 1 - revIdx;
              }
              if (matchIdx === -1) return prev;
              return prev.map((m, i) => (i === matchIdx ? { ...m, toolOutput: resultStr } : m));
            });
            onToolActionRef.current?.({ type: "tool-result", toolName: p.toolName, output: rawOutput });
          }),
        );

        // ai:done — stream complete
        unsubs.push(
          wsClient.on<{ sessionId: string; text: string }>("ai:done", (p) => {
            if (p.sessionId !== sessionId) return;
            // Finalize all streaming bubbles
            setMessages((prev) => prev.map((m) => (m.role === "assistant" && m.streaming ? { ...m, streaming: false } : m)));
            for (const m of newMsgs) {
              if ((m as any).streaming) (m as any).streaming = false;
            }
            setInternalStatus("ready");
            onFinishRef.current?.([...historySnapshot, ...newMsgs]);
            cleanup();
            resolve();
          }),
        );

        // ai:error
        unsubs.push(
          wsClient.on<{ sessionId: string; error: string }>("ai:error", (p) => {
            if (p.sessionId !== sessionId) return;
            setMessages((prev) => prev.map((m) => (m.role === "assistant" && m.streaming ? { ...m, streaming: false } : m)));
            const errMsg: ChatAgentMessage = { id: nextId("err"), role: "error", content: p.error, timestamp: new Date() };
            newMsgs.push(errMsg);
            setMessages((prev) => [...prev.filter((m) => !(m.role === "assistant" && m.streaming)), errMsg]);
            setInternalStatus("error");
            onFinishRef.current?.([...historySnapshot, ...newMsgs]);
            cleanup();
            resolve();
          }),
        );

        // Send ai:start to server
        wsClient.send("ai:start", {
          sessionId,
          providerId: internalProviderId,
          modelId: model,
          systemPrompt,
          messages: [...aiHistory, { role: "user", content: text }],
          toolSchemas,
          maxSteps,
        });
      });
    },
    [generating, internalProviderId, model, messages, systemPrompt, tools, maxSteps],
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setInternalStatus("ready");
    onFinish?.([]);
    onClear?.();
  }, [onFinish, onClear]);

  const handleProviderChange = useCallback(
    (id: string) => {
      setInternalProviderId(id);
      setInternalModel("");
      onChangeAiProvider?.(id);
    },
    [onChangeAiProvider],
  );

  const handleModelChange = useCallback(
    (m: string) => {
      setInternalModel(m);
      onChangeModel?.(m);
    },
    [onChangeModel],
  );

  return {
    messages,
    setMessages,
    status,
    generating,
    providerId,
    model,
    hasMessages,
    messagesEndRef,
    scrollContainerRef,
    scrollToBottom,
    forceFollow,
    handleSend,
    handleCancel,
    handleClear,
    handleProviderChange,
    handleModelChange,
  };
}
