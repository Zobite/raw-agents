import { StarsMinimalistic, TrashBinTrash } from "@solar-icons/react";

interface ChatHeaderProps {
  title: string;
  hasMessages: boolean;
  generating: boolean;
  onClear: () => void;
}

export function ChatHeader({ title, hasMessages, generating, onClear }: ChatHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-raised bg-surface shrink-0">
      <StarsMinimalistic size={14} className="text-primary opacity-70" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">{title}</span>

      <div className="flex-1" />

      {hasMessages && !generating && (
        <button
          type="button"
          onClick={onClear}
          title="Clear chat history"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-danger hover:bg-primary-50 transition-colors cursor-pointer border-0 bg-transparent"
        >
          <TrashBinTrash size={12} />
          Clear
        </button>
      )}
    </div>
  );
}
