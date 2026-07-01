import { AltArrowLeft, Lock, Restart } from "@solar-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { AgentMessage } from "src/common/types";
import { wsClient } from "../../../common/api/wsClient";
import { useAgentRunner } from "../../../common/hooks/useAgent";
import { AppLogo } from "../../../components/AppLogo";
import { InputArea } from "../../../components/chat/_components/InputArea";
import { MessageBubble } from "../../../components/chat/_components/MessageBubble";
import type { ChatAgentMessage } from "../../../components/chat/_components/types";
import { useAutoScroll } from "../../../components/chat/_components/useAutoScroll";

interface PublicAgent {
  id: string;
  name: string;
  description: string;
  startMessage: string;
  requiresPassword: boolean;
}

interface ConvMeta {
  id: string;
  title: string;
  createdAt: string | Date;
  isEmpty: boolean;
  status?: "running" | "done" | "failed";
}

/** Get or create a persistent device fingerprint (survives across sessions). */
function getFingerprint(): string {
  const key = "__device_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(key, fp);
  }
  return fp;
}

export default function PublicChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<PublicAgent | null>(null);

  // Auth state
  const [enteredPassword, setEnteredPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Sidebar state
  const [conversations, setConversations] = useState<ConvMeta[]>([]);
  // Track which conversations are actively processing (across all tabs)
  const [processingConvIds, setProcessingConvIds] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const { run, running, cancel } = useAgentRunner();
  const [streamingContent, setStreamingContent] = useState("");

  const passwordRef = useRef<HTMLInputElement>(null);
  const { scrollRef, scrollToBottom } = useAutoScroll();

  // Load public info & restore auth from saved token
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/public/agents/${id}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Unavailable");
          return;
        }

        setAgent(data);

        if (!data.requiresPassword) {
          setIsAuthenticated(true);
          return;
        }

        const savedToken = localStorage.getItem(`public_auth_${id}`);
        if (savedToken) {
          try {
            const tokenRes = await fetch(`/api/public/agents/${id}/verify-token`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: savedToken }),
            });
            const tokenData = await tokenRes.json();
            if (tokenData.valid) {
              setIsAuthenticated(true);
            } else {
              localStorage.removeItem(`public_auth_${id}`);
            }
          } catch {
            localStorage.removeItem(`public_auth_${id}`);
          }
        }
      } catch {
        setError("Unable to connect to server.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const agentId = agent?.id;

  /** Refresh conversation list from server */
  const refreshConversations = async (aId: string) => {
    const fp = getFingerprint();
    const res = await fetch(`/api/public/agents/${aId}/conversations?fp=${fp}`);
    if (res.ok) {
      const data: ConvMeta[] = await res.json();
      setConversations(data);
      return data;
    }
    return [];
  };

  /** Switch to a conversation — load its messages */
  const switchConversation = async (aId: string, cId: string) => {
    const fp = getFingerprint();
    setMessages([]);
    setStreamingContent("");
    setConversationId(cId);
    navigate(`/chat/${aId}?conv=${cId}`, { replace: true });
    const res = await fetch(`/api/public/agents/${aId}/conversations/${cId}?fp=${fp}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
  };

  /** Delete a conversation and refresh list */
  const deleteConversation = async (aId: string, cId: string) => {
    const fp = getFingerprint();
    await fetch(`/api/public/agents/${aId}/conversations/${cId}?fp=${fp}`, {
      method: "DELETE",
    });
    const convs = await refreshConversations(aId);
    // If deleted active conversation, switch to next or create new
    if (cId === conversationId) {
      const next = convs.find((c) => c.id !== cId);
      if (next) {
        await switchConversation(aId, next.id);
      } else {
        await newConversation(aId);
      }
    }
  };

  /** Create a new conversation (or switch to existing empty one) */
  const newConversation = async (aId: string) => {
    if (running) return;
    // If there's already an empty conversation, just switch to it
    const emptyConv = conversations.find((c) => c.isEmpty);
    if (emptyConv) {
      await switchConversation(aId, emptyConv.id);
      return;
    }
    const fp = getFingerprint();
    const res = await fetch(`/api/public/agents/${aId}/conversations?fp=${fp}`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      const convs = await refreshConversations(aId);
      if (data.conversationId) {
        setConversationId(data.conversationId);
        setMessages([]);
        setStreamingContent("");
        navigate(`/chat/${aId}?conv=${data.conversationId}`, { replace: true });
      }
      return convs;
    }
  };

  // On authenticated: load conversations list + restore from URL or most recent
  useEffect(() => {
    if (!isAuthenticated || !agentId) return;
    (async () => {
      const convs = await refreshConversations(agentId);
      const urlConvId = searchParams.get("conv");
      const target = urlConvId ? convs.find((c) => c.id === urlConvId) : null;
      if (target) {
        await switchConversation(agentId, target.id);
      } else if (convs.length > 0) {
        // Load the most recent conversation
        await switchConversation(agentId, convs[0].id);
      } else {
        // No conversations yet — create first one
        await newConversation(agentId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, agentId]);

  // Subscribe to WS events for current conversation
  useEffect(() => {
    if (!conversationId) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(
      wsClient.on<AgentMessage>("messages:created", (msg) => {
        if (msg.conversationId !== conversationId) return;
        if (msg.role === "tool" && msg.content === "") return;
        setMessages((prev) => {
          const filtered = prev.filter((m) => !(m.id.startsWith("optimistic-") && m.role === msg.role && m.content === msg.content));
          return [...filtered, msg];
        });
        // Refresh sidebar titles when new user message arrives
        if (msg.role === "user" && agentId) {
          refreshConversations(agentId);
        }
      }),
    );

    unsubs.push(
      wsClient.on<AgentMessage>("messages:updated", (msg) => {
        if (msg.conversationId !== conversationId) return;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
      }),
    );

    return () => {
      for (const u of unsubs) u();
    };
  }, [conversationId, agentId]);

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
        if (data.token) localStorage.setItem(`public_auth_${agent.id}`, data.token);
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

  /** Mark a conversation as processing */
  const markProcessing = useCallback((cId: string) => {
    setProcessingConvIds((prev) => {
      const next = new Set(prev);
      next.add(cId);
      return next;
    });
  }, []);

  /** Unmark a conversation as processing */
  const unmarkProcessing = useCallback((cId: string) => {
    setProcessingConvIds((prev) => {
      const next = new Set(prev);
      next.delete(cId);
      return next;
    });
  }, []);

  // Listen to WS events globally to track processing state across ALL tabs/clients
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // chat:done / chat:error — sent only to the initiating client
    unsubs.push(
      wsClient.on<{ conversationId: string; text: string }>("chat:done", (payload) => {
        unmarkProcessing(payload.conversationId);
      }),
    );

    unsubs.push(
      wsClient.on<{ conversationId: string; error: string }>("chat:error", (payload) => {
        unmarkProcessing(payload.conversationId);
      }),
    );

    // conversations:updated — broadcast to ALL clients (other tabs receive this)
    unsubs.push(
      wsClient.on<{ id: string; status: string }>("conversations:updated", (payload) => {
        if (payload.status === "running") {
          markProcessing(payload.id);
        } else {
          unmarkProcessing(payload.id);
        }
      }),
    );

    return () => {
      for (const u of unsubs) u();
    };
  }, [markProcessing, unmarkProcessing]);

  // Initialize processingConvIds from server status on conversations load
  useEffect(() => {
    const runningIds = conversations.filter((c) => c.status === "running").map((c) => c.id);
    if (runningIds.length > 0) {
      setProcessingConvIds((prev) => {
        const next = new Set(prev);
        for (const id of runningIds) next.add(id);
        return next;
      });
    }
  }, [conversations]);

  const handleSend = async (text: string) => {
    if (!agent || running || !conversationId) return;

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

    // Mark this conversation as processing
    markProcessing(convId);

    const savedToken = localStorage.getItem(`public_auth_${agent.id}`) ?? undefined;

    run({
      agent: mockAgent,
      conversationId: convId,
      userMessage: text,
      password: enteredPassword || undefined,
      token: savedToken,
      onChunk: (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      },
      onToolCall: () => {},
      onToolResult: () => {},
      onDone: async () => {
        setStreamingContent("");
        unmarkProcessing(convId);
        try {
          const res = await fetch(`/api/conversations/${convId}/messages`);
          if (res.ok) {
            const data = await res.json();
            setMessages(data);
          }
        } catch {
          /* best-effort */
        }
        if (agentId) refreshConversations(agentId);
      },
      onError: async (err) => {
        console.error(err);
        setStreamingContent("");
        unmarkProcessing(convId);
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

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(168,255,83,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(168,255,83,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative flex flex-col items-center gap-4">
          <div className="animate-pulse">
            <AppLogo size={48} />
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-primary/60 inline-block animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background relative overflow-hidden p-6">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(168,255,83,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(168,255,83,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative rounded-2xl border border-border/60 bg-surface p-10 text-center max-w-md w-full">
          <div className="w-12 h-12 rounded-full border border-danger/30 bg-danger/8 flex items-center justify-center mx-auto mb-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <title>Error</title>
              <path
                d="M12 9v4m0 4h.01M12 3l9.66 16.59A1 1 0 0120.66 21H3.34a1 1 0 01-.86-1.41L12 3z"
                stroke="var(--color-danger, #FF4D6D)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-display text-[18px] text-main font-semibold mb-2">Unavailable</h2>
          <p className="text-soft text-[14px] leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // ── Password gate ─────────────────────────────────────────────────────────

  if (!isAuthenticated && agent?.requiresPassword) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background relative overflow-hidden p-6">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(168,255,83,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(168,255,83,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute w-[320px] h-[320px] rounded-full bg-primary/[0.04] blur-[100px]" />

        <div className="relative rounded-2xl border border-border/60 bg-surface p-8 max-w-sm w-full">
          <div className="flex flex-col items-center mb-7">
            <div className="mb-5">
              <AppLogo size={44} />
            </div>
            <h2 className="font-display text-[18px] text-main font-semibold">{agent.name}</h2>
            <p className="text-muted mt-1.5 text-[13px]">Enter password to continue</p>
          </div>

          <form onSubmit={verifyPassword} className="flex flex-col gap-3">
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="password"
                placeholder="Password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-background border border-border/80 rounded-xl outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-main placeholder:text-muted text-[14px] transition-all"
                ref={passwordRef}
              />
            </div>
            {authError && <span className="text-[12px] font-medium text-danger pl-1">{authError}</span>}
            <button
              type="submit"
              disabled={verifying || !enteredPassword}
              className="w-full py-2.5 rounded-xl bg-primary text-secondary text-[14px] font-semibold hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {verifying ? <Restart className="animate-spin" size={15} /> : "Unlock"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Chat screen ───────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(168,255,83,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(168,255,83,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={`
          fixed md:relative z-40 md:z-auto
          flex flex-col h-full
          w-64 shrink-0
          bg-surface/95 backdrop-blur-md
          border-r border-border/40
          transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:border-0 md:overflow-hidden"}
        `}
      >
        {/* Sidebar header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AppLogo size={22} />
            <span className="font-display text-[13px] font-semibold text-main">{agent?.name}</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-muted hover:text-soft transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <AltArrowLeft size={16} />
          </button>
        </div>

        {/* New Chat button — ghost, green on hover */}
        <div className="px-3 pb-3 shrink-0">
          <button
            type="button"
            onClick={() => agentId && newConversation(agentId)}
            disabled={running}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-border/40 text-muted text-[13px] font-medium hover:border-primary/30 hover:text-primary hover:bg-primary/6 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <title>New</title>
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Accent line */}
        <div className="mx-3 mb-3 h-px bg-border/30 shrink-0" />

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4" style={{ scrollbarWidth: "thin" }}>
          {conversations.length === 0 ? (
            <p className="text-[12px] text-muted text-center py-4">No conversations yet</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {conversations.map((conv) => {
                const isActive = conv.id === conversationId;
                const isProcessing = processingConvIds.has(conv.id);
                return (
                  <div
                    key={conv.id}
                    className={`
                      group relative flex items-center rounded-md transition-all
                      ${isActive ? "bg-white/5 border-l-2 border-l-primary pl-0" : "border-l-2 border-l-transparent hover:bg-white/4"}
                    `}
                  >
                    <button type="button" onClick={() => agentId && switchConversation(agentId, conv.id)} className="flex-1 text-left px-3 py-2.5 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p
                          className={`text-sm font-medium leading-snug line-clamp-2 flex-1 min-w-0 ${isActive ? "text-main" : "text-soft group-hover:text-main"}`}
                        >
                          {conv.title}
                        </p>
                        {isProcessing && (
                          <span className="shrink-0 flex items-center gap-1" title="Processing...">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="w-1 h-1 rounded-full bg-primary/70 inline-block animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                    </button>
                    {/* Delete button — show on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        agentId && deleteConversation(agentId, conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 shrink-0 mr-2 p-1 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-all"
                      title="Delete conversation"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <title>Delete</title>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main chat area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Floating header */}
        <div className="absolute top-4 left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto relative overflow-hidden rounded-2xl border border-primary/15 shadow-[0_0_30px_rgba(168,255,83,0.06)]">
            <div className="absolute inset-0 bg-surface/95 backdrop-blur-xl" />
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 50%, rgba(168,255,83,0.8), transparent 50%), radial-gradient(circle at 85% 50%, rgba(156,154,242,0.6), transparent 50%)",
              }}
            />

            <div className="relative flex items-center gap-3 pl-2 pr-3 py-2.5">
              {/* Sidebar toggle (mobile) */}
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="md:hidden text-muted hover:text-soft transition-colors p-1.5 rounded-lg hover:bg-white/5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <title>Menu</title>
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Logo */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-xl bg-primary/10 blur-sm scale-125" />
                <div className="relative w-8 h-8 rounded-xl bg-background/60 border border-primary/20 flex items-center justify-center">
                  <AppLogo size={20} />
                </div>
              </div>

              {/* Name */}
              <h1 className="font-display text-[13px] font-semibold text-main leading-tight whitespace-nowrap pr-1">{agent?.name}</h1>

              <div className="w-px h-4 bg-border/40 shrink-0" />

              {/* New Chat button */}
              <button
                type="button"
                onClick={() => agentId && newConversation(agentId)}
                disabled={running}
                className="flex items-center gap-1.5 text-muted hover:text-soft transition-colors text-[11px] px-1.5 py-1 rounded-lg hover:bg-white/5 disabled:opacity-30"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <title>New Chat</title>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Chat
              </button>
            </div>

            <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto w-full relative z-0" style={{ scrollbarWidth: "thin" }}>
          <div className="max-w-3xl mx-auto w-full pt-24 pb-6 flex flex-col gap-1">
            {liveMessages.length === 0 && !running && (
              <div className="flex flex-col items-center justify-center text-center py-28 relative">
                {conversationId ? (
                  <>
                    <div className="absolute w-40 h-40 rounded-full bg-primary/[0.06] blur-[60px]" />
                    <div className="relative mb-6 opacity-30">
                      <AppLogo size={64} />
                    </div>
                    <p className="relative font-display text-[16px] text-main font-semibold">{agent?.name}</p>
                    <p className="relative text-[13px] text-muted mt-2 max-w-xs">Ask me anything to get started</p>
                  </>
                ) : (
                  <>
                    <div className="animate-pulse mb-3">
                      <AppLogo size={32} />
                    </div>
                    <p className="text-[13px] text-muted">Connecting...</p>
                  </>
                )}
              </div>
            )}

            {liveMessages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {running && !streamingContent && (
              <div className="flex items-center gap-2.5 px-4 py-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-raised border border-border/40">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 inline-block animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted ml-1">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 w-full relative z-10">
          <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          <div className="px-4 pb-4 pt-2">
            <div className="max-w-3xl mx-auto">
              <InputArea placeholder="Type a message..." generating={running} onSend={conversationId ? handleSend : () => {}} onCancel={cancel} hideConfig />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
