import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { forwardRef } from "react";
import { cn } from "src/lib/utils";

// ─── Checkbox ─────────────────────────────────────────────────────────────────
// Dark neon — unchecked: dark surface, checked: electric lime.

interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
}

const Checkbox = forwardRef<React.ComponentRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(function Checkbox({ className, label, ...props }, ref) {
  const checkboxEl = (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4.5 w-4.5 shrink-0 rounded-sm border-2 cursor-pointer transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary/60 data-[state=checked]:text-secondary",
        "data-[state=unchecked]:bg-surface data-[state=unchecked]:border-border hover:data-[state=unchecked]:border-border-hover",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none" className="text-secondary" aria-hidden="true">
          <title>Checked</title>
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return checkboxEl;

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Radix Checkbox renders a button child inside the label
    <label
      className={cn("inline-flex items-center gap-2.5 select-none cursor-pointer group", props.disabled && "opacity-50 cursor-not-allowed pointer-events-none")}
    >
      {checkboxEl}
      <span className="text-sm font-medium text-soft">{label}</span>
    </label>
  );
});

export { Checkbox };
export type { CheckboxProps };
