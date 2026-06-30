import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { AppLogo } from "src/components/AppLogo";
import RenderIf from "src/components/ui/RenderIf";

export type AgentNodeData = {
  name: string;
  description: string | null;
  color: string;
  aiModel: string | null;
  runStatus: string;
  toolCount: number; // how many tools assigned
};

export type AgentNodeType = Node<AgentNodeData, "agent">;

export function AgentNode({ data }: NodeProps<AgentNodeType>) {
  const toolLabel = `${data.toolCount} ${data.toolCount === 1 ? "tool" : "tools"}`;
  const modelName = data.aiModel ? data.aiModel.split("/").pop() : null;

  return (
    <div className="bg-surface border border-border rounded-xl pt-4 w-[200px] transition-all duration-200 cursor-default relative hover:border-border-hover hover:shadow-lg flex flex-col items-center text-center gap-1">
      {/* Handle — right side, connecting to tools */}
      <Handle type="source" position={Position.Right} className="flow-handle" />

      <AppLogo size={32} fill="#a8ff53" strokeWidth={1} />

      <div className="flex flex-col items-center w-full min-w-0 mb-2">
        <div className="text-xs text-main font-semibold w-full leading-snug">{data.name}</div>
      </div>

      <div className="flex flex-col px-2.5 pb-2.5 gap-1.5 w-full border-t border-border/40 pt-2.5 mt-0.5">
        <RenderIf condition={!!modelName}>
          <div className="flex items-center justify-between w-full">
            <span className="text-[9px] text-muted font-medium">Model</span>
            <span className="text-[9px] text-muted truncate max-w-[120px]">{modelName}</span>
          </div>
        </RenderIf>
        <div className="flex items-center justify-between w-full">
          <span className="text-[9px] text-muted">Tools</span>
          <span className="text-[9px] text-muted">{toolLabel}</span>
        </div>
      </div>
    </div>
  );
}
