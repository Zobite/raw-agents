import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef } from "react";
import { cn } from "src/lib/utils";

// ─── Switch ───────────────────────────────────────────────────────────────────
// Dark neon — off: dark track, on: electric lime.

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string;
}

const Switch = forwardRef<React.ComponentRef<typeof SwitchPrimitive.Root>, SwitchProps>(function Switch({ className, label, ...props }, ref) {
  const switchEl = (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary/60",
        "data-[state=unchecked]:bg-surface-raised data-[state=unchecked]:border-border-hover",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full shadow-sm transition-transform duration-200",
          "data-[state=checked]:translate-x-4 data-[state=checked]:bg-secondary",
          "data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-muted",
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return switchEl;

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Radix Switch renders a button child inside the label
    <label className={cn("inline-flex items-center gap-2.5 select-none cursor-pointer", props.disabled && "opacity-40 cursor-not-allowed")}>
      {switchEl}
      <span className="text-sm font-medium text-soft">{label}</span>
    </label>
  );
});

export { Switch };
export type { SwitchProps };
