import { forwardRef, useCallback, useEffect, useRef } from "react";
import { cn } from "src/lib/utils";

// ─── Textarea ─────────────────────────────────────────────────────────────────
// Dark neon — matches Input aesthetic, with autoHeight support.

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  resizable?: boolean;
  autoHeight?: boolean;
  maxRows?: number;
}

const LINE_HEIGHT = 20;
const PADDING_Y = 20;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { resizable = true, autoHeight = false, maxRows, className, onChange, value, ...rest },
  forwardedRef,
) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const adjustHeight = useCallback(() => {
    const el = internalRef.current;
    if (!el || !autoHeight) return;
    el.style.height = "auto";
    let targetHeight = el.scrollHeight;
    if (maxRows) {
      const maxHeight = LINE_HEIGHT * maxRows + PADDING_Y;
      targetHeight = Math.min(targetHeight, maxHeight);
    }
    el.style.height = `${targetHeight}px`;
  }, [autoHeight, maxRows]);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e);
      requestAnimationFrame(() => adjustHeight());
    },
    [onChange, adjustHeight],
  );

  return (
    <textarea
      ref={setRefs}
      value={value}
      onChange={handleChange}
      className={cn(
        "w-full font-normal leading-relaxed border outline-none transition-all duration-150",
        "min-h-24 px-3 py-2.5 text-sm rounded-md",
        "bg-surface text-main",
        "border-border",
        "placeholder:text-muted",
        "focus:border-primary",
        "disabled:bg-surface-raised disabled:text-muted disabled:border-border disabled:cursor-not-allowed",
        autoHeight ? "resize-none overflow-hidden" : resizable ? "resize-y" : "resize-none",
        autoHeight && "min-h-0!",
        className,
      )}
      {...rest}
    />
  );
});

export { Textarea };
export type { TextareaProps };
