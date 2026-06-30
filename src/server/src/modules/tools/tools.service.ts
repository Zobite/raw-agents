import { eq } from "drizzle-orm";
import {
  type NewAgentTool,
  agentToolAssignments,
  agentTools,
  getDb,
} from "../../common/db/client.js";
import { type RawQuery, listQuery } from "../../common/db/list-query.util.js";
import { BUILTIN_METADATA } from "../../common/ai/tools/resolveTools.js";
import { wsHub } from "../../common/ws/wsHub.js";
import { executeTool, validateToolCode } from "./python-runner.js";

const DATA_DIR = process.env.DATA_DIR ?? `${process.env.HOME}/.raw-agents`;

/** Core tools that are always-on and shouldn't appear in user-facing tool lists */
const ALWAYS_ON_TOOL_NAMES = new Set([
  "update_agent_memory",
  "manage_agent_note",
]);

/** Virtual AgentTool objects built from the BUILTIN_METADATA constant */
const BUILTIN_TOOLS = BUILTIN_METADATA.filter(
  (b) => !ALWAYS_ON_TOOL_NAMES.has(b.toolName),
).map((b) => ({
  id: `builtin:${b.toolName}`,
  name: b.toolName,
  label: b.toolLabel,
  description: b.description,
  icon: null,
  parameters: (b.parameters ?? { type: "object", properties: {}, required: [] }) as object,
  codeContent: "",
  isBuiltin: true,
  isActive: true,
  createdAt: new Date(0),
}));

/**
 * Seed builtin tools into the agent_tools DB table.
 * This ensures FOREIGN KEY references from agent_tool_assignments work correctly.
 * Uses INSERT OR IGNORE to avoid duplicates — safe to call on every startup.
 */
export function seedBuiltinTools(): void {
  const db = getDb();
  const allBuiltins = BUILTIN_METADATA.map((b) => ({
    id: `builtin:${b.toolName}`,
    name: b.toolName,
    label: b.toolLabel,
    description: b.description,
    parameters: (b.parameters ?? { type: "object", properties: {}, required: [] }) as object,
    codeContent: "",
    isBuiltin: true,
    isActive: !ALWAYS_ON_TOOL_NAMES.has(b.toolName), // always-on tools are hidden from UI
    createdAt: new Date(0),
  }));

  for (const bt of allBuiltins) {
    const existing = db
      .select({ id: agentTools.id })
      .from(agentTools)
      .where(eq(agentTools.id, bt.id))
      .get();

    if (!existing) {
      db.insert(agentTools)
        .values(bt)
        .run();
      console.log(`[Tools] Seeded builtin tool: ${bt.name}`);
    }
  }
}

/** Lookup a builtin tool by its virtual id (e.g. "builtin:fetch_webpage") */
export function getBuiltinTool(id: string) {
  return BUILTIN_TOOLS.find((t) => t.id === id) ?? null;
}

export function listTools(query: RawQuery = {}) {
  const result = listQuery({ table: agentTools }, query);
  // Only keep custom (non-builtin) tools from DB
  const dbItems = result.items.filter((t: any) => !t.isBuiltin);
  // Join constant-based builtins + custom tools from DB
  const items = [...BUILTIN_TOOLS, ...dbItems];
  return {
    ...result,
    items,
    total: items.length,
  };
}

export function getTool(id: string) {
  // Handle virtual builtin tool IDs
  if (id.startsWith("builtin:")) return getBuiltinTool(id);
  return getDb().select().from(agentTools).where(eq(agentTools.id, id)).get();
}

export function createTool(
  body: Pick<
    NewAgentTool,
    "name" | "label" | "description" | "parameters" | "codeContent"
  > & { isActive?: boolean },
) {
  const { isActive = true, ...rest } = body;
  const tool: NewAgentTool = {
    ...rest,
    id: crypto.randomUUID(),
    isActive,
    createdAt: new Date(),
  };
  getDb().insert(agentTools).values(tool).run();
  wsHub.emit("tools:created", tool);
  return tool;
}

export function updateTool(id: string, body: Partial<NewAgentTool>) {
  if (id.startsWith("builtin:")) throw new Error("Cannot modify builtin tools");
  const db = getDb();
  // Prevent modifying builtin tools
  const existing = db
    .select({ isBuiltin: agentTools.isBuiltin })
    .from(agentTools)
    .where(eq(agentTools.id, id))
    .get();
  if (existing?.isBuiltin) throw new Error("Cannot modify builtin tools");
  db.update(agentTools).set(body).where(eq(agentTools.id, id)).run();
  const updated = db
    .select()
    .from(agentTools)
    .where(eq(agentTools.id, id))
    .get();
  wsHub.emit("tools:updated", updated);
  return updated;
}

export function deleteTool(id: string) {
  if (id.startsWith("builtin:")) throw new Error("Cannot delete builtin tools");
  const db = getDb();
  // Prevent deleting builtin tools
  const existing = db
    .select({ isBuiltin: agentTools.isBuiltin })
    .from(agentTools)
    .where(eq(agentTools.id, id))
    .get();
  if (existing?.isBuiltin) throw new Error("Cannot delete builtin tools");
  // Find affected agents BEFORE cascade delete
  const affected = db
    .select({ agentId: agentToolAssignments.agentId })
    .from(agentToolAssignments)
    .where(eq(agentToolAssignments.toolId, id))
    .all();
  db.delete(agentTools).where(eq(agentTools.id, id)).run();
  wsHub.emit("tools:deleted", { id });
  // Notify affected agents that their tool assignments changed
  for (const { agentId } of affected) {
    wsHub.emit("agents:tools-updated", { agentId, toolId: id });
  }
}

export async function validateCode(code: string) {
  return validateToolCode(code);
}

export async function runCode(code: string, inputJson = "{}") {
  const resultStr = await executeTool("__anon__", code, inputJson, DATA_DIR);
  return JSON.parse(resultStr);
}

export async function runTool(id: string, inputJson = "{}", code?: string) {
  const tool = getTool(id);
  if (!tool) return null;
  const codeToRun = code ?? tool.codeContent;
  const resultStr = await executeTool(id, codeToRun, inputJson, DATA_DIR);
  return JSON.parse(resultStr);
}
