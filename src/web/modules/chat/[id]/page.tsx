import { Lock, Plain3, Restart, TrashBinTrash } from "@solar-icons/react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { AgentMessage } from "src/common/types";
import { wsClient } from "../../../common/api/wsClient";
import { useAgentRunner } from "../../../common/hooks/useAgent";
import type { ChatAgentMessage } from "../../../components/chat/ChatAgent";
import { InputArea } from "../../../components/chat/_components/InputArea";
import { MessageBubble } from "../../../components/chat/_components/MessageBubble";
import { useAutoScroll } from "../../../components/chat/_components/useAutoScroll";

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
          setError(data.message || "Không khả dụng");
        } else {
          setAgent(data);
          if (!data.requiresPassword) setIsAuthenticated(true);
        }
      })
      .catch(() => setError("Không thể kết nối tới server."))
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
        setAuthError(data.message || "Mật khẩu sai");
      }
    } catch {
      setAuthError("Lỗi kết nối.");
    } finally {
      setVerifying(false);
    }
  };

  const handleClear = async () => {
    if (!agentId || !conversationId || running) return;
    if (!confirm("Xóa toàn bộ lịch sử chat?")) return;
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
      <div className="flex h-screen w-full items-center justify-center bg-[#f5f4ed]">
        <Restart className="animate-spin text-[#87867f]" size={18} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#f5f4ed] p-6">
        <div className="rounded-2xl border border-[#f0eee6] bg-[#faf9f5] p-8 text-center shadow-[rgba(0,0,0,0.05)_0px_4px_24px] max-w-md w-full">
          <Plain3 size={36} className="mx-auto text-[#b0aea5] mb-4" />
          <h2 className="font-display text-[20px] text-[#141413] mb-2">Không khả dụng</h2>
          <p className="text-[#5e5d59] text-[14px] leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && agent?.requiresPassword) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#f5f4ed] p-6">
        <div className="rounded-2xl border border-[#f0eee6] bg-[#faf9f5] p-8 shadow-[rgba(0,0,0,0.05)_0px_4px_24px] max-w-md w-full">
          <div className="flex flex-col items-center mb-6">
            <div
              className="flex items-center justify-center rounded-xl mb-4 text-[#faf9f5] w-14 h-14 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)]"
              style={{ background: "#7aaee8" }}
            >
              <Lock size={22} />
            </div>
            <h2 className="font-display text-[20px] text-[#141413]">{agent.name}</h2>
            <p className="text-[#5e5d59] mt-1 text-[14px]">Nội dung này yêu cầu mật khẩu</p>
          </div>
          <form onSubmit={verifyPassword} className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="Nhập mật khẩu truy cập..."
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              className="px-4 py-2.5 bg-[#f5f4ed] border border-[#e8e6dc] rounded-xl outline-none focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/12 text-[#141413] placeholder:text-[#87867f] text-[14px] transition-all"
              ref={passwordRef}
            />
            {authError && <span className="text-[13px] font-medium text-[#b53333]">{authError}</span>}
            <button
              type="submit"
              disabled={verifying || !enteredPassword}
              className="w-full py-2.5 rounded-xl bg-[#c96442] text-[#faf9f5] text-[14px] font-medium hover:bg-[#b85535] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {verifying ? <Restart className="animate-spin" size={16} /> : "Xác nhận"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // CHAT SCREEN
  return (
    <div className="flex flex-col h-screen w-full bg-[#f8f8f6]">
      {/* Header */}
      <div className="shrink-0 border-b border-[#e8e6dc] bg-[#faf9f5] px-6 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center text-[#faf9f5] rounded-xl w-9 h-9 shrink-0 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)]"
              style={{ background: "#7aaee8" }}
            >
              <Plain3 size={17} />
            </div>
            <div>
              <h1 className="font-display text-[15px] text-[#141413] leading-tight">{agent?.name}</h1>
              <p className="text-[12px] text-[#5e5d59] leading-tight mt-0.5">{agent?.description || "Hỗ trợ tự động"}</p>
            </div>
          </div>
          {/* Clear button */}
          <button
            type="button"
            title="Xóa lịch sử chat"
            disabled={running || !conversationId}
            onClick={handleClear}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#87867f] hover:text-[#b53333] hover:bg-[#fef0ee] transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none"
          >
            <TrashBinTrash size={14} />
          </button>
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
                    className="flex items-center justify-center text-[#faf9f5] rounded-2xl w-12 h-12 mb-4 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06)]"
                    style={{ background: "#7aaee8" }}
                  >
                    <Plain3 size={22} />
                  </div>
                  <p className="font-display text-[15px] text-[#141413]">{agent?.name}</p>
                  <p className="text-[13px] text-[#87867f] mt-1">Bắt đầu trò chuyện</p>
                </>
              ) : (
                <>
                  <Restart size={20} className="animate-spin text-[#87867f] mb-3" />
                  <p className="text-[13px] text-[#87867f]">Đang kết nối...</p>
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
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#87867f] inline-block animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 w-full px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <InputArea placeholder="Nhập tin nhắn..." generating={running} onSend={conversationId ? handleSend : () => {}} onCancel={cancel} hideConfig />
        </div>
      </div>
    </div>
  );
}
