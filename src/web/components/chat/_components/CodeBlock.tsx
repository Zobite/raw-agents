import { Clipboard, ClipboardCheck } from "@solar-icons/react";
import { useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { MermaidBlock } from "./MermaidBlock";

// ── Language display labels ───────────────────────────────────────────────
const LANG_LABELS: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  py: "Python",
  python: "Python",
  sh: "Shell",
  bash: "Bash",
  zsh: "Zsh",
  shell: "Shell",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  md: "Markdown",
  markdown: "Markdown",
  rs: "Rust",
  rust: "Rust",
  go: "Go",
  java: "Java",
  cpp: "C++",
  c: "C",
  cs: "C#",
  csharp: "C#",
  php: "PHP",
  rb: "Ruby",
  ruby: "Ruby",
  swift: "Swift",
  kt: "Kotlin",
  kotlin: "Kotlin",
  graphql: "GraphQL",
  dockerfile: "Dockerfile",
  xml: "XML",
};

// ── Props ─────────────────────────────────────────────────────────────────
interface CodeBlockProps {
  language?: string;
  children: string;
}

export function CodeBlock({ language = "", children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const lang = language.toLowerCase().trim();
  const isMermaid = lang === "mermaid";
  const label = isMermaid ? "Mermaid" : (LANG_LABELS[lang] ?? (lang || "Code"));

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Mermaid — completely separate block, no header
  if (isMermaid) {
    return <MermaidBlock>{children}</MermaidBlock>;
  }

  return (
    <div className="rounded-xl border border-border/60 bg-code">
      {/* Label + Copy — above the code card */}
      <div className="flex items-center justify-between px-4 py-2 select-none ">
        <span className="font-mono text-xs font-medium text-muted tracking-wide">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-1 rounded-md border border-transparent bg-transparent text-muted text-xs cursor-pointer leading-none transition-colors hover:text-primary hover:border-primary/25 hover:bg-primary/5"
          title="Copy code"
        >
          {copied ? (
            <>
              <ClipboardCheck size={14} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Clipboard size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code card */}
      <div className="rounded-xl overflow-hidden bg-code">
        <SyntaxHighlighter language={lang || "text"} style={atomOneDark} useInlineStyles wrapLongLines={false} PreTag="div" CodeTag="code">
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
