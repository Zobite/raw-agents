import { Hono } from "hono";
import { getPublicAgent, verifyPublicPassword, getOrCreatePublicConversation } from "./public.service.js";

const app = new Hono();

// GET /api/public/agents/:id
app.get("/agents/:id", (c) => {
  const result = getPublicAgent(c.req.param("id"));
  return c.json(result.data);
});

// POST /api/public/agents/:id/verify
app.post("/agents/:id/verify", async (c) => {
  const { password } = await c.req.json<{ password?: string }>();
  const result = verifyPublicPassword(c.req.param("id"), password);
  return c.json({ valid: result.valid });
});

// GET /api/public/agents/:id/conversation
app.get("/agents/:id/conversation", (c) => {
  const result = getOrCreatePublicConversation(c.req.param("id"));
  return c.json(result.data);
});

export default app;
