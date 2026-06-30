/**
 * MonacoEditorInner — chứa toàn bộ static imports monaco-editor.
 * File này chỉ được load khi LazyMonacoEditor được render lần đầu.
 * Không import file này trực tiếp — dùng MonacoEditor thay thế.
 */

import { type Monaco, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
// ── Worker setup — PHẢI đứng đầu file ────────────────────────────────────────
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

// Ghi đè MonacoEnvironment → Vite bundle workers, không load từ CDN
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "json") return new JsonWorker();
    return new EditorWorker();
  },
};

// Bypass CDN — dùng monaco-editor đã bundle local qua Vite
loader.config({ monaco });

// ── Custom warm-light theme ───────────────────────────────────────────────────
monaco.editor.defineTheme("warm-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#faf8f5",
    "editor.foreground": "#2a2a26",
    "editor.lineHighlightBackground": "#f5f0e8",
    "editorCursor.foreground": "#6b5c3e",
    "editor.selectionBackground": "#e8dfc8",
    "editor.inactiveSelectionBackground": "#ede6d8",
    "editorIndentGuide.background": "#e8e0d0",
    "editorLineNumber.foreground": "#c8b890",
  },
});

monaco.editor.defineTheme("neon-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#121317",
    "editor.foreground": "#f3f4f6",
    "editor.lineHighlightBackground": "#1a1d23",
    "editorCursor.foreground": "#a8ff53",
    "editor.selectionBackground": "#a8ff5320",
    "editor.inactiveSelectionBackground": "#a8ff5310",
    "editorIndentGuide.background": "#ffffff10",
    "editorLineNumber.foreground": "#8b8d94",
    "editorGutter.background": "#121317",
    "editorWidget.background": "#1a1d23",
    "editorWidget.border": "#ffffff14",
    "input.background": "#1a1d23",
    "dropdown.background": "#1a1d23",
  },
});

import type { EditorProps } from "@monaco-editor/react";
import MonacoReactEditor from "@monaco-editor/react";
import type { editor as editorNS } from "monaco-editor";

// ── Default options ───────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: editorNS.IStandaloneEditorConstructionOptions = {
  fontSize: 13,
  fontFamily: "'Geist Mono Variable', 'Geist Mono', 'SFMono-Regular', Menlo, monospace",
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 10, bottom: 10 },
  tabSize: 2,
  wordWrap: "off",
  automaticLayout: true,
  scrollbar: {
    verticalScrollbarSize: 4,
    horizontalScrollbarSize: 4,
    horizontal: "visible",
  },
  stickyScroll: { enabled: false },
};

export type EditorInstance = editorNS.IStandaloneCodeEditor;
export type { Monaco };

interface MonacoEditorInnerProps extends Omit<EditorProps, "loading" | "theme"> {
  theme?: string;
  height?: string | number;
  options?: editorNS.IStandaloneEditorConstructionOptions;
}

export function MonacoEditorInner({ theme = "warm-light", options, height = "100%", ...props }: MonacoEditorInnerProps) {
  return <MonacoReactEditor height={height} theme={theme} options={{ ...DEFAULT_OPTIONS, ...options }} {...props} />;
}
