import { eq } from "drizzle-orm";
import {
  getDb,
  agentMessages,
  agentConversations,
  type NewAgentMessage,
} from "../db/client.js";
import { wsHub } from "../../common/ws/wsHub.js";

/** Load last 20 user/assistant messages for a conversation (for AI history). */
export function loadHistory(conversationId: string) {
  return getDb()
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.conversationId, conversationId))
    .orderBy(agentMessages.createdAt)
    .all()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

/** Save a message to DB and broadcast via WS so all tabs see it. */
export function saveMessage(
  data: Omit<NewAgentMessage, "id" | "createdAt">,
): { id: string } & NewAgentMessage {
  const db = getDb();
  const id = crypto.randomUUID();
  const msg = { ...data, id, createdAt: new Date() } as NewAgentMessage;
  db.insert(agentMessages).values(msg).run();
  wsHub.broadcast("messages:created", msg);
  return { ...msg, id };
}

/** Merge patch into message metadata and broadcast the update. */
export function patchMessageMetadata(
  msgId: string,
  patch: Record<string, unknown>,
) {
  const db = getDb();
  const row = db.select().from(agentMessages).where(eq(agentMessages.id, msgId)).get();
  if (!row) return;
  const merged = { ...(row.metadata ?? {}), ...patch } as Record<string, unknown>;
  db.update(agentMessages).set({ metadata: merged }).where(eq(agentMessages.id, msgId)).run();
  wsHub.broadcast("messages:updated", { ...row, metadata: merged });
}

/** Update conversation status and broadcast the change. */
export function updateConversation(
  conversationId: string,
  data: { status: "done" | "failed"; finishedAt: Date; errorMessage?: string },
) {
  const db = getDb();
  db.update(agentConversations).set(data).where(eq(agentConversations.id, conversationId)).run();
  const updated = db
    .select()
    .from(agentConversations)
    .where(eq(agentConversations.id, conversationId))
    .get();
  if (updated) wsHub.broadcast("conversations:updated", updated);
}
