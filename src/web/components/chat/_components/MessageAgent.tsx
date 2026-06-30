import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { MarkdownTable } from "./MarkdownTable";
import type { ChatAgentMessage } from "./types";
import "./markdown.css";
import { AppLogo } from "src/components/AppLogo";

interface MessageAgentProps {
  msg: ChatAgentMessage;
  assistantLabel?: string;
  assistantColor?: string | null;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  /** Whether to show the badge + sender label. Controlled by the parent to avoid
   *  duplicate badges when consecutive agent items (tool-groups + messages) are chained. */
  showAvatar?: boolean;
}

// Custom ReactMarkdown components — plugs in our decorated CodeBlock + MarkdownTable
const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1] ?? "";
    const codeText = String(children).replace(/\n$/, "");
    const isBlock = codeText.includes("\n") || !!match;

    if (isBlock) {
      return <CodeBlock language={lang}>{codeText}</CodeBlock>;
    }

    // Inline code
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  table({ children }) {
    return <MarkdownTable>{children}</MarkdownTable>;
  },
};

const DEFAULT_AGENT_COLOR = "#6b9a4a";

/** AI assistant avatar — exported for reuse in ToolCallBubble & CallAgentBubble */
export function AgentAvatar({ color }: { color?: string | null }) {
  const c = color ?? DEFAULT_AGENT_COLOR;
  // Derive a very light bg from the color (10% opacity overlay on white)
  const bgStyle = {
    background: `${c}18`,
    border: `1px solid ${c}40`,
  };
  return (
    <div className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden" style={bgStyle} aria-label="Assistant avatar">
      <AppLogo size={28} />
    </div>
  );
}

export function MessageAgent({ msg, assistantLabel = "Assistant", assistantColor, showAvatar = true }: MessageAgentProps) {
  const color = assistantColor ?? DEFAULT_AGENT_COLOR;

  return (
    <div className="ca-fade-in mt-1">
      {/* Badge row — only on first in chain */}
      {showAvatar && (
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-1">
          {/* Agent badge — game HUD style, uses agent color */}
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase select-none"
            style={{
              background: color,
              color: "#fff",
              letterSpacing: "0.08em",
            }}
          >
            {assistantLabel}
          </span>

          {/* Timestamp */}
          <span className="text-[10px] text-muted/50 font-mono tracking-wide select-none">{formatTime(msg.timestamp)}</span>
        </div>
      )}

      {/* Markdown content */}
      <div className="px-4 pb-0.5">
        <div className="ca-markdown text-sm leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {msg.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
