export interface ToolEntry {
  id: string; // tool ID in agent_tools
  name: string;
  label: string;
  description: string;
  isBuiltin: boolean;
}

export function ToolRow({
  tool,
  checked,
  onToggle,
}: {
  tool: ToolEntry;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "flex items-center border gap-3 px-4 py-3 rounded-md w-full text-left transition-all duration-[120ms] cursor-pointer",
        checked ? " bg-primary-50 border-primary-200" : " bg-surface hover:border-border-hover",
      ].join(" ")}
    >
      {/* Indicator */}
      <div
        className={[
          "w-[18px] h-[18px] flex items-center justify-center flex-shrink-0 transition-all duration-[120ms] rounded-[5px]",
          checked ? "bg-primary border-[1.5px] border-primary-700" : "bg-surface-raised border-[1.5px] border-border-hover",
        ].join(" ")}
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={["text-2xs font-semibold mb-[2px] transition-colors duration-[120ms]", checked ? "text-primary-600" : "text-soft"].join(" ")}>
          {tool.label}
        </div>
        <div className={["text-xs truncate", checked ? "text-primary-800" : "text-muted"].join(" ")}>{tool.description || tool.name}</div>
      </div>

      {/* Badge */}
      {tool.isBuiltin && <span className="text-2xs px-[6px] py-[2px] text-xs flex-shrink-0 bg-surface-raised text-muted rounded-sm">builtin</span>}
    </button>
  );
}
