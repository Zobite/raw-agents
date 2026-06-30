import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { forwardRef } from "react";
import { cn } from "src/lib/utils";

// ─── RadioGroup ───────────────────────────────────────────────────────────────
// Dark neon — unselected: dark surface, selected: electric lime with dot.

const RadioGroup = forwardRef<React.ComponentRef<typeof RadioGroupPrimitive.Root>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>>(
  function RadioGroup({ className, ...props }, ref) {
    return <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />;
  },
);

const RadioGroupItem = forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & { label?: string }
>(function RadioGroupItem({ className, label, ...props }, ref) {
  const radioEl = (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4.5 w-4.5 rounded-full border-2 cursor-pointer transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary/60",
        "data-[state=unchecked]:bg-surface data-[state=unchecked]:border-border hover:data-[state=unchecked]:border-border-hover",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-secondary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );

  if (!label) return radioEl;

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Radix RadioGroupItem renders a button child inside the label
    <label className={cn("inline-flex items-center gap-2.5 select-none cursor-pointer", props.disabled && "opacity-50 cursor-not-allowed")}>
      {radioEl}
      <span className="text-sm font-medium text-soft">{label}</span>
    </label>
  );
});

export { RadioGroup, RadioGroupItem };
