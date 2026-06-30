import { CheckCircle } from "@solar-icons/react";

export function AgentRow({
  agent,
  checked,
  onToggle,
  disabled,
}: {
  agent: { id: string; name: string; description?: string | null };
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={[
        "flex items-center gap-2.5 px-3 py-2.5 rounded-md w-full text-left transition-all duration-[120ms] cursor-pointer",
        disabled ? "opacity-40 pointer-events-none" : "",
        checked ? "bg-primary-50 hover:bg-primary-100" : "bg-transparent hover:bg-primary-50",
      ].join(" ")}
    >
      {/* Avatar */}
      <div
        className={[
          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-2xs font-bold transition-all",
          checked ? "bg-primary text-white" : "bg-surface-raised text-soft",
        ].join(" ")}
      >
        {agent.name.charAt(0).toUpperCase()}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={["text-xs font-semibold leading-[1.3] transition-colors", checked ? "text-primary-800" : "text-main"].join(" ")}>{agent.name}</div>
      </div>

      {/* Check — right side */}
      {checked && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
    </button>
  );
}
