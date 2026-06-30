import type { ReactNode } from "react";

interface RenderIfProps {
  condition: boolean | null | undefined;
  children: ReactNode | (() => ReactNode);
  fallback?: ReactNode;
}

export default function RenderIf({ condition, children, fallback = null }: RenderIfProps) {
  if (!condition) return <>{fallback}</>;
  return <>{typeof children === "function" ? children() : children}</>;
}
