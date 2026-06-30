/**
 * memory.ts — Builtin tool: update agent memory
 *
 * LangGraph JS version — uses @langchain/core/tools
 */

import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { agents, getDb } from "../../db/client.js";

export const makeMemoryTool = (agentId: string) =>
  tool(
    async ({ content }: { content: string }) => {
      const db = getDb();
      db.update(agents)
        .set({ memoryContent: content, updatedAt: new Date() })
        .where(eq(agents.id, agentId))
        .run();
      return JSON.stringify({ ok: true, message: "Memory updated." });
    },
    {
      name: "update_agent_memory",
      description:
        "Update your entire memory. Read the current content from the system prompt, edit it, then write back the full updated content.",
      schema: z.object({
        content: z
          .string()
          .describe(
            "Full new memory content (completely replaces old content). Use markdown.",
          ),
      }),
    },
  );
