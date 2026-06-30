import type { Ref } from "react";
import { RunPanel, type RunPanelHandle } from "./RunPanel";

interface TestTabProps {
  code: string;
  toolId?: string;
  runPanelRef: Ref<RunPanelHandle>;
}

export function TestTab({ code, toolId, runPanelRef }: TestTabProps) {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <RunPanel ref={runPanelRef} code={code} toolId={toolId} />
    </div>
  );
}
