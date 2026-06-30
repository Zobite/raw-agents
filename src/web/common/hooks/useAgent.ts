/**
 * useAgent.ts
 *
 * React hooks + streaming helpers for running agents.
 * All AI logic is on server — this file manages WS streaming + React state.
 *
 * Exports:
 *   - useAgentRunner  → stream chat via WS
 *   - useAgentAutoRun → trigger autonomous work session
 *   - ChatMessage     → shared type
 */

import { useCallback, useRef, useState } from "react";
import type { Agent } from "src/common/types";
import { updateAgent, upsertAgentLocal } from "src/modules/agents/common/agentsSlice";
import { createConversation, fetchConversations, fetchMessages } from "src/modules/chat/common/chatSlice";
import { store } from "src/store/store";
import { wsClient } from "../api/wsClient";

// ─── ChatMessage — shared type ────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolLabel?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  streaming?: boolean;
  createdAt: Date;
}

// ─── Stream Helpers (internal) ────────────────────────────────────────────────

interface AgentStreamCallbacks {
  onChunk: (chunk: string) => void;
  onThinking: (chunk: string) => void;
  onToolCall: (call: { toolCallId?: string; toolName: string; toolLabel: string; input: unknown }) => void;
  onToolResult: (call: { toolCallId?: string; toolName: string; result: unknown }) => void;
  onDone: (text: string) => void;
  onError: (err: string) => void;
  abortSignal?: AbortSignal;
  password?: string;
}

/**
 * Stream chat from server-side agent via WebSocket.
 * Sends chat:send and listens for chat:* events filtered by conversationId.
 */
async function streamAgentChat(agentId: string, message: string, conversationId: string, callbacks: AgentStreamCallbacks): Promise<void> {
  const { onChunk, onThinking, onToolCall, onToolResult, onDone, onError, abortSignal, password } = callbacks;

  if (abortSignal?.aborted) return;

  // Wait until WS is connected and has a clientId
  try {
    await wsClient.waitForClientId();
  } catch {
    onError("WebSocket not connected");
    return;
  }

  if (abortSignal?.aborted) return;

  return new Promise<void>((resolve) => {
    const unsubs: Array<() => void> = [];
    let settled = false;

    function cleanup() {
      for (const unsub of unsubs) unsub();
    }

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    }

    // If abort is requested, clean up listeners and resolve
    if (abortSignal) {
      const onAbort = () => settle(resolve);
      abortSignal.addEventListener("abort", onAbort, { once: true });
      unsubs.push(() => abortSignal.removeEventListener("abort", onAbort));
    }

    // chat:chunk — text-delta for this conversation
    unsubs.push(
      wsClient.on<{ conversationId: string; text: string }>("chat:chunk", (payload) => {
        if (payload.conversationId !== conversationId) return;
        onChunk(payload.text);
      }),
    );

    // chat:thinking — reasoning content for this conversation
    unsubs.push(
      wsClient.on<{ conversationId: string; text: string }>("chat:thinking", (payload) => {
        if (payload.conversationId !== conversationId) return;
        onThinking(payload.text);
      }),
    );

    // chat:tool-call
    unsubs.push(
      wsClient.on<{ conversationId: string; toolCallId: string; toolName: string; toolLabel: string; input: unknown }>("chat:tool-call", (payload) => {
        if (payload.conversationId !== conversationId) return;
        onToolCall({
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
          toolLabel: payload.toolLabel,
          input: payload.input,
        });
      }),
    );

    // chat:tool-result
    unsubs.push(
      wsClient.on<{ conversationId: string; toolCallId: string; toolName: string; result: unknown }>("chat:tool-result", (payload) => {
        if (payload.conversationId !== conversationId) return;
        onToolResult({ toolCallId: payload.toolCallId, toolName: payload.toolName, result: payload.result });
      }),
    );

    // chat:done — server has saved assistant message, FE can loadMessages
    unsubs.push(
      wsClient.on<{ conversationId: string; text: string }>("chat:done", (payload) => {
        if (payload.conversationId !== conversationId) return;
        settle(() => onDone(payload.text));
        resolve();
      }),
    );

    // chat:error
    unsubs.push(
      wsClient.on<{ conversationId: string; error: string }>("chat:error", (payload) => {
        if (payload.conversationId !== conversationId) return;
        settle(() => onError(payload.error));
        resolve();
      }),
    );

    // Send the chat message to trigger the stream
    wsClient.send("chat:send", { agentId, conversationId, message, password });
  });
}

/**
 * Stop a running background stream — POST /api/agents/:id/chat/stop
 */
async function stopAgentChat(agentId: string, conversationId: string): Promise<void> {
  const BASE_URL: string = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "";
  try {
    await fetch(`${BASE_URL}/api/agents/${agentId}/chat/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
  } catch {
    // best-effort — ignore errors
  }
}

// ─── useAgentRunner ───────────────────────────────────────────────────────────
// FE only manages streaming state + UI callbacks.
// Server handles: history load, message save, conversation status.

interface RunOptions {
  agent: Agent;
  conversationId: string;
  userMessage: string;
  onChunk: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onToolCall: (call: { toolCallId?: string; toolName: string; toolLabel: string; input: unknown }) => void;
  onToolResult: (call: { toolCallId?: string; toolName: string; result: unknown }) => void;
  /** Called when server is done — messages already saved by server */
  onDone: (text: string) => void;
  onError: (err: string) => void;
  password?: string;
}

export function useAgentRunner() {
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<number>(0);
  // Track current run's agent + conversation for stop endpoint
  const agentIdRef = useRef<string>("");
  const conversationIdRef = useRef<string>("");

  const run = useCallback(async (options: RunOptions) => {
    const { agent, conversationId, userMessage, onChunk, onThinking, onToolCall, onToolResult, onDone, onError, password } = options;

    agentIdRef.current = agent.id;
    conversationIdRef.current = conversationId;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const currentRunId = ++runIdRef.current;

    setRunning(true);

    try {
      await streamAgentChat(agent.id, userMessage, conversationId, {
        onChunk,
        onThinking: onThinking ?? (() => {}),
        onToolCall,
        onToolResult,
        onDone,
        onError,
        abortSignal: abort.signal,
        password,
      });
    } finally {
      if (runIdRef.current === currentRunId) {
        setRunning(false);
      }
    }
  }, []);

  const cancel = useCallback(() => {
    // 1. Tell server to abort the background AI task
    if (agentIdRef.current && conversationIdRef.current) {
      stopAgentChat(agentIdRef.current, conversationIdRef.current).catch(() => {});
    }
    // 2. Signal the WS stream listener to clean up
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  return { run, running, cancel };
}

// ─── useAgentAutoRun ──────────────────────────────────────────────────────────
// Trigger one autonomous "work session" for an agent.
// Server saves messages + updates conversation status automatically.

const DEFAULT_START_MESSAGE = "Start working. Please complete your task and report the results.";

export function useAgentAutoRun() {
  const { run } = useAgentRunner();
  const runningAgents = useRef<Set<string>>(new Set());

  const trigger = useCallback(
    async (agent: Agent) => {
      if (runningAgents.current.has(agent.id)) return;
      runningAgents.current.add(agent.id);
      store.dispatch(upsertAgentLocal({ id: agent.id, runStatus: "running" }));

      const userMessage = agent.startMessage?.trim() || DEFAULT_START_MESSAGE;

      // Create conversation — server will save messages + update status
      // Create conversation via Redux
      const conv = await store.dispatch(createConversation({ agentId: agent.id, title: "Auto run", trigger: "cron" })).unwrap();
      const conversationId = conv.id;

      run({
        agent,
        conversationId,
        userMessage,

        onChunk: () => {},

        onToolCall: ({ toolName, toolLabel }) => {
          console.debug(`[AutoRun] ${agent.name} → tool: ${toolLabel ?? toolName}`);
        },

        onToolResult: ({ toolName, result }) => {
          console.debug(`[AutoRun] ${agent.name} ← result:`, toolName, result);
        },

        onDone: async () => {
          // Server already saved assistant message + updated conversation status
          await store.dispatch(updateAgent({ id: agent.id, lastRunAt: new Date() }));
          store.dispatch(upsertAgentLocal({ id: agent.id, runStatus: "idle" }));
          runningAgents.current.delete(agent.id);
          // Refresh if viewing this agent
          const state = store.getState();
          if (state.chat.activeConversationId === conversationId) {
            void store.dispatch(fetchMessages(conversationId));
          }
          void store.dispatch(fetchConversations(agent.id));
          console.info(`[AutoRun] ${agent.name} done → idle`);
        },

        onError: async (err) => {
          console.error(`[AutoRun] ${agent.name} error:`, err);
          // Server already updated conversation to failed status
          await store.dispatch(updateAgent({ id: agent.id, lastRunAt: new Date() }));
          store.dispatch(upsertAgentLocal({ id: agent.id, runStatus: "idle" }));
          runningAgents.current.delete(agent.id);
          void store.dispatch(fetchConversations(agent.id));
        },
      });
    },
    [run],
  );

  return { trigger };
}
