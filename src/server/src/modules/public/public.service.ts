import { eq, and, desc } from "drizzle-orm";
import { getDb, agents, agentConversations, agentMessages } from "../../common/db/client.js";
import { BadRequestException } from "../../common/exceptions/http.exception.js";

export function getPublicAgent(agentId: string) {
  const db = getDb();
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) throw new BadRequestException("Agent not found");
  if (!agent.isPublic) throw new BadRequestException("Thật đáng tiếc, Agent này không được chia sẻ công khai.");
  return {
    data: {
      id: agent.id, name: agent.name, description: agent.description,
      requiresPassword: !!agent.publicPassword && agent.publicPassword.length > 0,
    },
  };
}

export function verifyPublicPassword(agentId: string, password?: string) {
  const db = getDb();
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent || !agent.isPublic) throw new BadRequestException("Agent unavailable");
  if (agent.publicPassword && agent.publicPassword !== password) {
    throw new BadRequestException("Mật khẩu không chính xác.");
  }
  return { valid: true };
}

export function getOrCreatePublicConversation(agentId: string) {
  const db = getDb();
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent || !agent.isPublic) throw new BadRequestException("Agent unavailable");

  const existing = db.select().from(agentConversations)
    .where(and(eq(agentConversations.agentId, agentId), eq(agentConversations.trigger, "public")))
    .orderBy(desc(agentConversations.createdAt))
    .get();

  let convId: string;
  if (existing) {
    convId = existing.id;
  } else {
    convId = crypto.randomUUID();
    const now = new Date();
    db.insert(agentConversations).values({
      id: convId, agentId, title: "Guest Session", trigger: "public",
      status: "running", startedAt: now, createdAt: now,
    }).run();
  }

  const msgs = db.select().from(agentMessages)
    .where(eq(agentMessages.conversationId, convId))
    .orderBy(agentMessages.createdAt).all()
    .filter((r) => !(r.role === "tool" && r.content === ""));

  return { data: { conversationId: convId, messages: msgs } };
}
