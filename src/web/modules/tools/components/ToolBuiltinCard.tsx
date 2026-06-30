import { Lock } from "@solar-icons/react";
import type { AgentTool } from "src/common/types";

export function ToolBuiltinCard({ tool }: { tool: AgentTool }) {
  const paramCount = (() => {
    const schema = tool.parameters as { properties?: Record<string, unknown> };
    return Object.keys(schema?.properties ?? {}).length;
  })();

  return (
    <div className="flex flex-col rounded-xl border border-violet-200 bg-violet-50/30 p-5 text-left">
      {/* Top: icon + text */}
      <div className="flex flex-1 items-start gap-3.5">
        {/* Icon */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-500">
          <Lock size={20} />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <span className="text-[15px] font-bold text-main truncate leading-tight block">{tool.label}</span>
          {/* Always reserve 2 lines of space for description */}
          <div className="mt-1.5 min-h-10">
            <p className="text-[13px] font-medium text-muted leading-relaxed line-clamp-2">{tool.description || "No description"}</p>
          </div>
        </div>
      </div>

      {/* Bottom: tags */}
      <div className="mt-3 pt-3 border-t border-violet-100 flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-raised text-[11px] font-semibold text-soft">
          {paramCount > 0 ? `${paramCount} param${paramCount !== 1 ? "s" : ""}` : "No params"}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-100 text-[11px] font-semibold text-violet-600">Built-in</span>
      </div>
    </div>
  );
}
