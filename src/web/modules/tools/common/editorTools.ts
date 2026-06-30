import { apiClient } from "src/common/api";
import { zodSchema } from "src/common/types/tool";
import type { Tool } from "src/common/types/tool";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// fetch_webpage — server-side tool (stub schema only; real exec on server)
// Included here so its schema gets sent to /api/ai/stream via toolSchemas,
// where the server swaps it for the real BUILTIN_REGISTRY implementation.
// ─────────────────────────────────────────────────────────────────────────────

export const FETCH_WEBPAGE_TOOL_NAME = "fetch_webpage";

export const fetchWebpageToolStub: Tool = {
  description: "Fetches the content of a webpage by URL. Use this to read articles, documentation, or any public web page.",
  inputSchema: zodSchema(
    z.object({
      url: z.string().describe("The full URL of the webpage to fetch"),
      strip_html: z.boolean().optional().describe("Strip HTML tags and return plain text (default: true)"),
    }),
  ),
  execute: async () => ({ ok: false, error: "This tool runs server-side only" }),
};

/**
 * update_editor_code — frontend-only tool.
 * AI calls this tool to update code into the Monaco Editor.
 */
export const UPDATE_EDITOR_CODE_TOOL_NAME = "update_editor_code";

const updateSchema = z.object({
  code: z
    .string()
    .describe(
      "THE ENTIRE Python function body (raw code, NO 'def main(input):' header, NO markdown fences). This is the content that will be placed INSIDE def main(input) by the system.",
    ),
  summary: z.string().optional().describe("Short description of changes made (shown to the user)."),
});

export const updateEditorCodeTool: Tool = {
  description:
    "Write the entire Python function body into the editor (COMPLETELY replacing the old content). The 'code' field is the raw Python body — NO 'def main(input):', NO markdown fences. You must call this tool to apply the code; NEVER return code as text in the conversation.",
  inputSchema: zodSchema(updateSchema),
  execute: async ({ summary }: { code: string; summary?: string }) => {
    return {
      ok: true,
      message: summary ?? "Code successfully updated into editor.",
      // Guide AI to the next step directly in tool result
      next: "MANDATORY NEXT STEP: Call run_current_script IMMEDIATELY to test the code. NEVER call update_editor_code again before testing.",
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// run_current_script — frontend-only tool
// AI only passes testInput; code + toolId are taken from closure in AISidebar.
// ─────────────────────────────────────────────────────────────────────────────

export const RUN_CURRENT_SCRIPT_TOOL_NAME = "run_current_script";

const runSchema = z.object({
  testInput: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Parameters object to pass into the script. Keys must match the @param declarations in the code. Example: { query: 'lofi music', limit: 5 }"),
});

/**
 * Factory: create tool with bundled code + toolId.
 * Calls invoke("execute_custom_tool") directly and returns the result to AI.
 */
export function makeRunCurrentScriptTool(getCode: () => string): Tool {
  return {
    description:
      "Run the current Python script from the editor inside a sandbox environment (Python venv). Pass only testInput — the code is automatically fetched from the editor. Returns { success: true, output } or { success: false, error } with a Python traceback.",
    inputSchema: zodSchema(runSchema),
    execute: async ({ testInput }: { testInput?: Record<string, unknown> }) => {
      try {
        const code = getCode(); // always reads latest editor code
        const inputJson = typeof testInput === "string" ? testInput : JSON.stringify(testInput ?? {});
        // Use runCode — sends live code directly, no DB lookup
        const parsed = await apiClient.post<{ ok: boolean; result?: unknown; error?: string }>("/api/tools/run-code", { code, inputJson });
        if (parsed.ok) {
          return { success: true, output: parsed.result };
        }
        return { success: false, error: parsed.error };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}
