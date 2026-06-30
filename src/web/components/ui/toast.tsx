import { CheckCircle, CloseCircle, DangerTriangle, InfoCircle } from "@solar-icons/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "src/lib/utils";

// ─── Toast ────────────────────────────────────────────────────────────────────
// Dark neon toast notification with variant colors and countdown progress.

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface VariantConfig {
  frame: string;
  accent: string;
  iconColor: string;
  textColor: string;
  progressColor: string;
  icon: ReactNode;
}

const VARIANT_CONFIG: Record<ToastVariant, VariantConfig> = {
  success: {
    frame: "bg-surface border-primary/30 shadow-drop",
    accent: "bg-primary",
    iconColor: "text-primary",
    textColor: "text-main",
    progressColor: "bg-primary/40",
    icon: <CheckCircle size={18} weight="BoldDuotone" />,
  },
  error: {
    frame: "bg-surface border-danger/30 shadow-drop",
    accent: "bg-danger",
    iconColor: "text-danger",
    textColor: "text-main",
    progressColor: "bg-danger/40",
    icon: <DangerTriangle size={18} weight="BoldDuotone" />,
  },
  info: {
    frame: "bg-surface border-border shadow-drop",
    accent: "bg-soft",
    iconColor: "text-soft",
    textColor: "text-main",
    progressColor: "bg-soft/40",
    icon: <InfoCircle size={18} weight="BoldDuotone" />,
  },
};

let nextId = 0;
let addToastGlobal: ((msg: string, variant: ToastVariant) => void) | null = null;

/**
 * Imperative toast trigger — call from anywhere after `<ToastProvider>` is mounted.
 *
 * ```ts
 * toast.success("Saved!");
 * toast.error("Something went wrong");
 * toast.info("Heads up");
 * ```
 */
export const toast = {
  success: (msg: string) => addToastGlobal?.(msg, "success"),
  error: (msg: string) => addToastGlobal?.(msg, "error"),
  info: (msg: string) => addToastGlobal?.(msg, "info"),
};

// Keep backward compat alias
export const gameToast = toast;

const TOAST_DURATION = 3200;

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const cfg = VARIANT_CONFIG[item.variant];

  return (
    <div
      onClick={() => onDismiss(item.id)}
      className={cn(
        "relative overflow-hidden rounded-lg border-2 cursor-pointer",
        "pointer-events-auto select-none min-w-[260px] max-w-[380px]",
        "animate-in slide-in-from-top-4 fade-in-0 zoom-in-95",
        cfg.frame,
      )}
    >
      <div className="absolute top-0 left-2 right-2 h-px bg-linear-to-r from-transparent via-border to-transparent" />
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", cfg.accent)} />
        <div className={cn("shrink-0 flex items-center", cfg.iconColor)}>{cfg.icon}</div>
        <span className={cn("text-[13px] font-semibold leading-snug tracking-wide", cfg.textColor)}>{item.message}</span>
        <div className="shrink-0 ml-auto opacity-40 hover:opacity-70 transition-opacity">
          <CloseCircle size={14} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px]">
        <div className={cn("h-full rounded-full", cfg.progressColor)} style={{ animation: `toast-progress ${TOAST_DURATION}ms linear forwards` }} />
      </div>
      <style>{"@keyframes toast-progress { from { width: 100% } to { width: 0% } }"}</style>
    </div>
  );
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, TOAST_DURATION);
    timers.current.set(id, timer);
  }, []);

  useEffect(() => {
    addToastGlobal = addToast;
    return () => {
      addToastGlobal = null;
    };
  }, [addToast]);

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      for (const t of currentTimers.values()) clearTimeout(t);
    };
  }, []);

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onDismiss={dismiss} />
      ))}
    </div>,
    document.body,
  );
}
