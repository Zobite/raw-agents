import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { type ReactNode, forwardRef } from "react";
import { cn } from "src/lib/utils";

// ─── Button ───────────────────────────────────────────────────────────────────
// Dark neon — electric lime primary, pill shapes, flat aesthetic.

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center font-medium tracking-wide select-none",
    "transition-all duration-150 cursor-pointer",
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: ["bg-primary text-secondary border border-primary/80", "hover:bg-primary-hover", "active:scale-[0.98]"].join(" "),
        secondary: [
          "bg-secondary text-soft border border-border",
          "hover:bg-surface-raised hover:text-main hover:border-border-hover",
          "active:scale-[0.98]",
        ].join(" "),
        ghost: [
          "bg-transparent text-soft border border-transparent",
          "hover:bg-surface-raised hover:text-main hover:border-border",
          "active:bg-surface-raised active:scale-[0.98]",
        ].join(" "),
        danger: [
          "bg-danger text-white border border-danger-hover",
          "hover:bg-danger-hover hover:border-danger-active",
          "active:bg-danger-active active:scale-[0.98]",
        ].join(" "),
      },
      size: {
        sm: "h-field-sm px-3 text-xs gap-1.5 rounded-full",
        md: "h-field-md px-4 text-sm gap-2 rounded-full",
        lg: "h-field-lg px-5 text-md gap-2.5 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, loading = false, block = false, asChild = false, children, className, disabled, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : "button"}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), block && "w-full", loading && "cursor-wait", className)}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-current opacity-60 inline-block animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      ) : (
        <>
          {icon && <span className="shrink-0 flex items-center">{icon}</span>}
          {children && <span>{children}</span>}
        </>
      )}
    </Comp>
  );
});

export { Button, buttonVariants };
export type { ButtonProps };
