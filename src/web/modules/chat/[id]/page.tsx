import { Lock, Plain3, Restart } from "@solar-icons/react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { AgentMessage } from "src/common/types";
import { wsClient } from "../../../common/api/wsClient";
import { useAgentRunner } from "../../../common/hooks/useAgent";
import { InputArea } from "../../../components/chat/_components/InputArea";
import { MessageBubble } from "../../../components/chat/_components/MessageBubble";
import type { ChatAgentMessage } from "../../../components/chat/_components/types";
import { useAutoScroll } from "../../../components/chat/_components/useAutoScroll";
import { DeleteConfirmButton } from "../../../components/ui/alert-dialog";

interface PublicAgent {
  id: string;
  name: string;
  description: string;
  startMessage: string;
  requiresPassword: boolean;
}

export default function PublicChatPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<PublicAgent | null>(null);

  // Auth state
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Chat state — local, no chatStore needed
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const { run, running, cancel } = useAgentRunner();
  const [streamingContent, setStreamingContent] = useState("");

  const passwordRef = useRef<HTMLInputElement>(null);

  // ── Auto-scroll: callback-ref + MutationObserver handles ALL cases ───────
  const { scrollRef, scrollToBottom } = useAutoScroll();

  // Load public info
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/public/agents/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Unavailable");
        } else {
          setAgent(data);
          if (!data.requiresPassword) setIsAuthenticated(true);
        }
      })
      .catch(() => setError("Unable to connect to server."))
      .finally(() => setLoading(false));
  }, [id]);

  // Load or create guest conversation from BE when authenticated
  const agentId = agent?.id;
  useEffect(() => {
    if (!isAuthenticated || !agentId) return;
    fetch(`/api/public/agents/${agentId}/conversation`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.conversationId) {
          setConversationId(data.conversationId);
          setMessages(data.messages ?? []);
        }
      })
      .catch((err) => console.error("[PublicChat] conversation fetch failed:", err));
  }, [isAuthenticated, agentId]);

  // Subscribe to WS messages:created + messages:updated filtered by conversationId
  useEffect(() => {
    if (!conversationId) return;
    const unsubs: (() => void)[] = [];

    // messages:created — new messages (user, assistant, tool-call)
    unsubs.push(
      wsClient.on<AgentMessage>("messages:created", (msg) => {
        if (msg.conversationId !== conversationId) return;
        if (msg.role === "tool" && msg.content === "") return; // skip empty tool msgs
        setMessages((prev) => {
          // Remove optimistic duplicate if same role+content
          const filtered = prev.filter((m) => !(m.id.startsWith("optimistic-") && m.role === msg.role && m.content === msg.content));
          return [...filtered, msg];
        });
      }),
    );

    // messages:updated — tool output patches (patchMessageMetadata)
    unsubs.push(
      wsClient.on<AgentMessage>("messages:updated", (msg) => {
        if (msg.conversationId !== conversationId) return;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
      }),
    );

    return () => {
      for (const u of unsubs) u();
    };
  }, [conversationId]);

  // Auto-focus password input
  useEffect(() => {
    if (!isAuthenticated && agent?.requiresPassword) {
      passwordRef.current?.focus();
    }
  }, [isAuthenticated, agent]);

  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredPassword || !agent) return;

    setVerifying(true);
    setAuthError("");

    try {
      const res = await fetch(`/api/public/agents/${agent.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: enteredPassword }),
      });
      const data = await res.json();
      if (data.valid) {
        setIsAuthenticated(true);
      } else {
        setAuthError(data.message || "Incorrect password");
      }
    } catch {
      setAuthError("Connection error.");
    } finally {
      setVerifying(false);
    }
  };

  const handleClear = async () => {
    if (!agentId || !conversationId || running) return;
    await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    setConversationId(null);
    setMessages([]);
    setStreamingContent("");
    // Create a new guest conversation
    fetch(`/api/public/agents/${agentId}/conversation`)
      .then((r) => r.json())
      .then((data) => {
        if (data.conversationId) setConversationId(data.conversationId);
      })
      .catch(console.error);
  };

  const handleSend = async (text: string) => {
    if (!agent || running || !conversationId) return;

    // Push user message optimistically so it appears immediately
    const optimisticMsg: any = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: text,
      conversationId,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setStreamingContent("");
    scrollToBottom();

    const mockAgent: any = { id: agent.id, name: agent.name };
    const convId = conversationId;

    run({
      agent: mockAgent,
      conversationId: convId,
      userMessage: text,
      password: enteredPassword,
      onChunk: (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      },
      onToolCall: () => {},
      onToolResult: () => {},
      onDone: async () => {
        setStreamingContent("");
        // Re-fetch messages from server to get final state (tool outputs, etc.)
        try {
          const res = await fetch(`/api/conversations/${convId}/messages`);
          if (res.ok) {
            const data = await res.json();
            setMessages(data);
          }
        } catch {
          /* best-effort */
        }
      },
      onError: async (err) => {
        console.error(err);
        setStreamingContent("");
        // Re-fetch to show final state
        try {
          const res = await fetch(`/api/conversations/${convId}/messages`);
          if (res.ok) {
            const data = await res.json();
            setMessages(data);
          }
        } catch {
          /* best-effort */
        }
      },
    });
  };

  const toDisplayMsg = (m: any): ChatAgentMessage => {
    if (m.role === "tool") {
      const meta = (m.metadata ?? {}) as Record<string, unknown>;
      return {
        id: m.id,
        role: "tool-call" as const,
        content: String(meta.toolName ?? m.content ?? "tool"),
        toolName: String(meta.toolName ?? m.content ?? "Tool"),
        toolLabel: meta.toolLabel as string | undefined,
        toolInput: meta.toolInput,
        toolOutput: meta.toolOutput as string | undefined,
        toolError: Boolean(meta.toolError),
        streaming: false,
        timestamp: m.createdAt ?? new Date(),
      };
    }
    return {
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      streaming: false,
      timestamp: m.createdAt ?? new Date(),
    };
  };

  const liveMessages: ChatAgentMessage[] = [
    ...messages.map(toDisplayMsg),
    ...(streamingContent
      ? [
          {
            id: "stream",
            role: "assistant" as const,
            content: streamingContent,
            streaming: true,
            timestamp: new Date(),
          },
        ]
      : []),
  ];

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Restart className="animate-spin text-muted" size={18} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-card max-w-md w-full">
          <Plain3 size={36} className="mx-auto text-muted mb-4" />
          <h2 className="font-display text-[20px] text-main mb-2">Unavailable</h2>
          <p className="text-soft text-[14px] leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && agent?.requiresPassword) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-card max-w-md w-full">
          <div className="flex flex-col items-center mb-6">
            <div
              className="flex items-center justify-center rounded-xl mb-4 text-white w-14 h-14 shadow-[0px_0px_0px_1px_rgba(255,255,255,0.08)]"
              style={{ background: "#7aaee8" }}
            >
              <Lock size={22} />
            </div>
            <h2 className="font-display text-[20px] text-main font-bold">{agent.name}</h2>
            <p className="text-soft mt-1 text-[14px]">This content requires a password</p>
          </div>
          <form onSubmit={verifyPassword} className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="Enter access password..."
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              className="px-4 py-2.5 bg-surface-raised border border-border rounded-xl outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/12 text-main placeholder:text-muted text-[14px] transition-all"
              ref={passwordRef}
            />
            {authError && <span className="text-[13px] font-medium text-danger">{authError}</span>}
            <button
              type="submit"
              disabled={verifying || !enteredPassword}
              className="w-full py-2.5 rounded-xl bg-primary text-secondary text-[14px] font-medium hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {verifying ? <Restart className="animate-spin" size={16} /> : "Submit"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // CHAT SCREEN
  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-surface px-6 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center text-white rounded-xl w-9 h-9 shrink-0 shadow-[0px_0px_0px_1px_rgba(255,255,255,0.08)]"
              style={{ background: "#7aaee8" }}
            >
              <Plain3 size={17} />
            </div>
            <div>
              <h1 className="font-display text-[15px] text-main leading-tight">{agent?.name}</h1>
              <p className="text-[12px] text-soft leading-tight mt-0.5">{agent?.description || "Automated assistant"}</p>
            </div>
          </div>
          {/* Clear button */}
          <DeleteConfirmButton
            label="Clear all chat history?"
            description="This action cannot be undone."
            onConfirm={handleClear}
            disabled={running || !conversationId}
          />
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto w-full" style={{ scrollbarWidth: "thin" }}>
        <div className="max-w-3xl mx-auto w-full py-6 flex flex-col gap-1">
          {liveMessages.length === 0 && !running && (
            <div className="flex flex-col items-center justify-center text-center py-24">
              {conversationId ? (
                <>
                  <div
                    className="flex items-center justify-center text-white rounded-2xl w-12 h-12 mb-4 shadow-[0px_0px_0px_1px_rgba(255,255,255,0.06)]"
                    style={{ background: "#7aaee8" }}
                  >
                    <Plain3 size={22} />
                  </div>
                  <p className="font-display text-[15px] text-main">{agent?.name}</p>
                  <p className="text-[13px] text-muted mt-1">Start a conversation</p>
                </>
              ) : (
                <>
                  <Restart size={20} className="animate-spin text-muted mb-3" />
                  <p className="text-[13px] text-muted">Connecting...</p>
                </>
              )}
            </div>
          )}

          {liveMessages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {/* Typing Indicator */}
          {running && !streamingContent && (
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted inline-block animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 w-full px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <InputArea placeholder="Type a message..." generating={running} onSend={conversationId ? handleSend : () => {}} onCancel={cancel} hideConfig />
        </div>
      </div>
    </div>
  );
}
