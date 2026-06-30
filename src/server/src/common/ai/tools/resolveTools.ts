/**
 * resolveTools.ts (server-side)
 *
 * Builds the full tool list for an agent:
 *   - Builtin tools (resolved by name from BUILTIN_REGISTRY)
 *   - Custom tools (from DB agent_tools table)
 *   - Always-on: update_memory + note
 *   - call_agent (if enabled via assignment)
 *
 * LangGraph JS version — uses @langchain/core/tools
 */

import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { executeTool } from "../../../modules/tools/python-runner.js";
import { agentTools, agents, getDb } from "../../db/client.js";
import { makeCallAgentTool } from "../builtin-tools/call-agent.js";
import {
  fetchWebpageTool,
  getCurrentTimeTool,
  makeMemoryTool,
  makeNoteTool,
} from "./builtins.js";

// ─── Builtin tool registry ────────────────────────────────────────────────────

export const BUILTIN_REGISTRY: Record<string, StructuredToolInterface> = {
  get_current_time: getCurrentTimeTool,
  fetch_webpage: fetchWebpageTool,
};

export const BUILTIN_LABELS: Record<string, string> = {
  get_current_time: "Get Current Time",
  fetch_webpage: "Fetch",
  call_agent: "Call Agent",
  update_agent_memory: "Update Agent Memory",
  manage_agent_note: "Manage Agent Note",
};

/**
 * Converts a snake_case or camelCase tool name to a human-readable Title Case label.
 * e.g. "gia_vang" → "Gia Vang", "fetchWebpage" → "Fetch Webpage"
 */
export function formatToolName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get a human-readable label for any tool name.
 * Priority: BUILTIN_LABELS → DB label column → formatToolName fallback
 */
export function getToolLabel(toolName: string): string {
  if (BUILTIN_LABELS[toolName]) return BUILTIN_LABELS[toolName];
  try {
    const db = getDb();
    const row = db
      .select({ label: agentTools.label })
      .from(agentTools)
      .where(eq(agentTools.name, toolName))
      .get();
    if (row?.label && row.label !== toolName) return row.label;
  } catch {
    /* ignore — DB may not be available in all contexts */
  }
  return formatToolName(toolName);
}

/**
 * For `call_agent` tool calls — resolve a label that includes the called agent's name.
 * e.g. "Call Research Agent" instead of generic "Call Agent".
 * Falls back to "Call Agent" if agent_id is missing or agent not found.
 */
export function getCallAgentLabel(args: unknown): string {
  try {
    const agentId =
      (args as any)?.agent_id ?? (args as any)?.agentId ?? (args as any)?.id;
    if (!agentId || typeof agentId !== "string") return BUILTIN_LABELS.call_agent;
    const db = getDb();
    const row = db
      .select({ name: agents.name })
      .from(agents)
      .where(eq(agents.id, agentId))
      .get();
    if (row?.name) return `Call ${row.name}`;
  } catch {
    /* ignore */
  }
  return BUILTIN_LABELS.call_agent;
}

export const BUILTIN_METADATA = [
  {
    toolName: "get_current_time",
    toolLabel: "Get Current Time",
    description:
      "Returns the current date and time in the specified timezone (default: UTC).",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    toolName: "fetch_webpage",
    toolLabel: "Fetch",
    description:
      "Fetches the full HTML content of a webpage by URL. Use this to read articles, documentation, or any public web page.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL of the webpage to fetch" },
        output: { type: "string", enum: ["html", "md"], description: 'Output format: "md" (default) or "html"' },
      },
      required: ["url"],
    },
  },
  {
    toolName: "call_agent",
    toolLabel: "Call Agent",
    description:
      "Delegates a prompt or task to another specialized agent by ID and returns their response.",
    parameters: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "The ID of the agent to call (UUID)" },
        message: { type: "string", description: "The message or task to send to the agent" },
        context: { type: "string", description: "Optional extra context from your current task" },
      },
      required: ["agent_id", "message"],
    },
  },
  {
    toolName: "update_agent_memory",
    toolLabel: "Update Agent Memory",
    description:
      "Replace the agent's long-term memory buffer with new facts, preferences, or short notes.",
    parameters: {
      type: "object",
      properties: {
        memory: { type: "string", description: "The new memory content to store" },
      },
      required: ["memory"],
    },
  },
  {
    toolName: "manage_agent_note",
    toolLabel: "Manage Agent Note",
    description:
      "Create, read, update, or delete long documents, plans, scripts, and lists for the agent.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "read", "update", "delete"], description: "The operation to perform" },
        title: { type: "string", description: "The title of the note" },
        content: { type: "string", description: "The content of the note" },
      },
      required: ["action"],
    },
  },
];

// ─── Custom tool builder ──────────────────────────────────────────────────────

function buildCustomTool(record: {
  id: string;
  name: string;
  description: string;
  parameters: object;
  codeContent: string;
}): StructuredToolInterface {
  const DATA_DIR =
    process.env.DATA_DIR ?? `${process.env.HOME}/.raw-agents`;

  // Build zod schema from JSON schema parameters
  const props = ((record.parameters as any)?.properties ?? {}) as Record<
    string,
    { type?: string; description?: string; default?: unknown }
  >;
  const required = ((record.parameters as any)?.required ?? []) as string[];
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
    if (def.default !== undefined) {
      field = field.optional().default(def.default) as z.ZodType;
    } else if (!required.includes(key)) {
      field = field.optional() as z.ZodType;
    }
    shape[key] = field;
  }

  const schema = z.object(shape);

  return tool(
    async (input: unknown) => {
      try {
        const inputJson = JSON.stringify(input ?? {});
        const resultStr = await executeTool(
          record.id,
          record.codeContent,
          inputJson,
          DATA_DIR,
        );
        const result = JSON.parse(resultStr) as {
          ok: boolean;
          result?: unknown;
          error?: string;
        };
        if (!result.ok) {
          return JSON.stringify({
            error: result.error ?? `Custom tool "${record.name}" failed`,
            ok: false,
          });
        }
        return JSON.stringify(result.result);
      } catch (err) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
          ok: false,
        });
      }
    },
    {
      name: record.name,
      description: record.description,
      schema,
    },
  );
}

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * Resolve full tool list for an agent from DB.
 * enabledTools: array of tool names the agent has enabled.
 * Always injects update_agent_memory + manage_agent_note.
 *
 * Returns StructuredToolInterface[] instead of ToolSet object.
 */
export function resolveAgentTools(
  agentId: string,
  enabledTools: string[],
): StructuredToolInterface[] {
  const db = getDb();
  const tools: StructuredToolInterface[] = [];

  // 1. Builtin tools
  for (const name of enabledTools) {
    if (name in BUILTIN_REGISTRY) {
      tools.push(BUILTIN_REGISTRY[name]);
    }
  }

  // 2. call_agent (if enabled)
  if (enabledTools.includes("call_agent")) {
    tools.push(makeCallAgentTool(agentId));
  }

  // 3. Custom tools (from DB, filtered by enabledTools)
  const customToolNames = enabledTools.filter(
    (n) =>
      !(n in BUILTIN_REGISTRY) &&
      n !== "call_agent" &&
      n !== "update_agent_memory" &&
      n !== "manage_agent_note",
  );

  if (customToolNames.length > 0) {
    const rows = db
      .select()
      .from(agentTools)
      .where(eq(agentTools.isActive, true))
      .all();
    for (const row of rows) {
      if (customToolNames.includes(row.name)) {
        tools.push(buildCustomTool(row));
      }
    }
  }

  // 4. Always-on: update_agent_memory + manage_agent_note
  tools.push(makeMemoryTool(agentId));
  tools.push(makeNoteTool(agentId));

  return tools;
}

/**
 * Resolve only the specified tools by name.
 * Does NOT inject always-on memory/note tools.
 */
export function resolveAgentToolsRaw(
  agentId: string,
  toolNames: string[],
): StructuredToolInterface[] {
  const db = getDb();
  const tools: StructuredToolInterface[] = [];

  for (const name of toolNames) {
    if (name in BUILTIN_REGISTRY) {
      tools.push(BUILTIN_REGISTRY[name]);
    } else if (name === "call_agent") {
      tools.push(makeCallAgentTool(agentId));
    } else if (name === "update_agent_memory") {
      tools.push(makeMemoryTool(agentId));
    } else if (name === "manage_agent_note") {
      tools.push(makeNoteTool(agentId));
    }
  }

  // Custom tools from DB
  const customNames = toolNames.filter(
    (n) =>
      !(n in BUILTIN_REGISTRY) &&
      n !== "call_agent" &&
      n !== "update_agent_memory" &&
      n !== "manage_agent_note",
  );
  if (customNames.length > 0) {
    const rows = db
      .select()
      .from(agentTools)
      .where(eq(agentTools.isActive, true))
      .all();
    for (const row of rows) {
      if (customNames.includes(row.name)) {
        tools.push(buildCustomTool(row));
      }
    }
  }

  return tools;
}
