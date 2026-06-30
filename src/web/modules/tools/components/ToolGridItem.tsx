import { Lock, Programming } from "@solar-icons/react";
import type { AgentTool } from "src/common/types";
import { SolarIcon } from "src/components/SolarIcon";

export function ToolGridItem({
  tool,
  onClick,
}: {
  tool: AgentTool;
  onClick?: () => void;
}) {
  const isBuiltin = tool.isBuiltin;
  const isActive = tool.isActive;
  const FallbackIcon = isBuiltin ? Lock : Programming;

  const paramCount = (() => {
    const schema = tool.parameters as { properties?: Record<string, unknown> };
    return Object.keys(schema?.properties ?? {}).length;
  })();

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      {...(onClick && { type: "button" as const, onClick })}
      className={[
        "group flex flex-col w-full rounded-xl p-4 text-left transition-all duration-150 border",
        onClick ? "cursor-pointer hover:border-primary/30 hover:bg-primary/[0.03]" : "cursor-default opacity-70",
        isBuiltin ? "bg-tertiary/[0.05] border-tertiary/10" : "bg-surface-raised/60 border-border",
      ].join(" ")}
    >
      {/* Top: icon + text */}
      <div className="flex items-start gap-3 w-full">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
            isBuiltin ? "bg-tertiary/10 text-tertiary" : isActive ? "bg-primary/10 text-primary" : "bg-surface-raised text-muted",
          ].join(" ")}
        >
          <SolarIcon name={tool.icon} size={18} fallback={<FallbackIcon size={18} />} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-main truncate leading-tight group-hover:text-primary transition-colors duration-150">{tool.label}</span>
            {!isBuiltin && <span className={["w-1.5 h-1.5 rounded-full shrink-0 transition-colors", isActive ? "bg-primary" : "bg-muted/40"].join(" ")} />}
          </div>
          <span className="text-[11px] text-muted line-clamp-2 block mt-1 leading-relaxed min-h-[2lh]">{tool.description || "No description"}</span>
        </div>
      </div>

      {/* Bottom: tags */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/60 w-full">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface-raised text-muted">
          {paramCount > 0 ? `${paramCount} param${paramCount !== 1 ? "s" : ""}` : "No params"}
        </span>
        {isBuiltin && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-tertiary/10 text-tertiary">Built-in</span>}
      </div>
    </Wrapper>
  );
}
