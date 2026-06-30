/**
 * Base Monaco Editor component — dùng chung toàn app.
 *
 * - Tự configure MonacoEnvironment (workers) + loader (bypass CDN)
 * - Lazy load @monaco-editor/react
 * - Re-export type EditorInstance để consumer dùng với useRef
 *
 * Usage:
 *   import { MonacoEditor, type EditorInstance } from "@/components/ui/MonacoEditor";
 *   const ref = useRef<EditorInstance>(null);
 *   <MonacoEditor language="python" value={code} onChange={...} onMount={...} />
 */

import type { EditorProps, Monaco } from "@monaco-editor/react";
import { Restart } from "@solar-icons/react";
import type { editor } from "monaco-editor";
import { Suspense, lazy } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Re-export để consumer dùng với useRef */
export type EditorInstance = editor.IStandaloneCodeEditor;
export type { Monaco };

export interface MonacoEditorProps extends Omit<EditorProps, "loading" | "theme"> {
  /** Monaco theme — default: "warm-light" */
  theme?: string;
  /** Màu nền fallback loading (phù hợp theme) — default: "#faf8f5" */
  loadingBg?: string;
}

// ── Lazy Monaco — toàn bộ setup (workers, theme, loader) nằm trong chunk này ──
//
// Tất cả static imports của monaco-editor được đặt bên trong module này để
// chúng chỉ được evaluate khi chunk được load, không ảnh hưởng main bundle.

const LazyMonacoEditor = lazy(() => import("./MonacoEditorInner").then((m) => ({ default: m.MonacoEditorInner })));

// ── Component ─────────────────────────────────────────────────────────────────

export function MonacoEditor({ theme = "warm-light", loadingBg = "#faf8f5", options, height = "100%", ...props }: MonacoEditorProps) {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center gap-2"
          style={{
            height,
            background: loadingBg,
            color: "#a89880",
          }}
        >
          <Restart className="animate-spin" style={{ width: 14, height: 14 }} />
          <span style={{ fontSize: 12 }}>Loading editor...</span>
        </div>
      }
    >
      <LazyMonacoEditor height={height} theme={theme} options={options} {...props} />
    </Suspense>
  );
}
