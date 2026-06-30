import { DeleteConfirmButton } from "src/components/ui/alert-dialog";

interface DangerZoneProps {
  agentName: string;
  onDelete: () => void;
}

export function DangerZone({ agentName, onDelete }: DangerZoneProps) {
  return (
    <div className="pt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14px] font-semibold text-main">Delete Agent</div>
          <div className="text-[12px] text-muted mt-1">This action cannot be undone. All conversations and tasks will be lost.</div>
        </div>

        <DeleteConfirmButton label={`Delete "${agentName}"?`} description="This action cannot be undone." onConfirm={onDelete} />
      </div>
    </div>
  );
}
