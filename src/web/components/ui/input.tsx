import { forwardRef } from "react";
import { cn } from "src/lib/utils";

// ─── Input ────────────────────────────────────────────────────────────────────
// Dark neon — dark surface, neon lime focus border, rounded-md.

type InputSize = "sm" | "md" | "lg";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: InputSize;
}

const sizeClasses: Record<InputSize, string> = {
  sm: "h-field-sm px-2.5 text-xs rounded-md",
  md: "h-field-md px-3 text-sm rounded-md",
  lg: "h-field-lg px-3.5 text-md rounded-md",
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ inputSize = "md", className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full font-normal border outline-none transition-all duration-150",
        "bg-surface text-main",
        "border-border",
        "placeholder:text-muted",
        "focus:border-primary focus:bg-surface",
        "disabled:bg-surface-raised disabled:text-muted disabled:border-border disabled:cursor-not-allowed",
        sizeClasses[inputSize],
        className,
      )}
      {...rest}
    />
  );
});

export { Input };
export type { InputProps, InputSize };
