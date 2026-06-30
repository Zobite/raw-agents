// ─── Tool Node ────────────────────────────────────────────────────────────────
// Custom React Flow node for displaying a Tool in the agent-tool mapping graph.

import { Bolt } from "@solar-icons/react";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";

export type ToolNodeData = {
  label: string;
  name: string;
  description: string;
  isBuiltin: boolean;
  connectedCount: number; // how many agents use this tool
};

export type ToolNodeType = Node<ToolNodeData, "tool">;

export function ToolNode({ data }: NodeProps<ToolNodeType>) {
  const color = data.isBuiltin ? "#a8ff53" : "#9c9af2";
  const bgColor = data.isBuiltin ? "rgba(168, 255, 83, 0.12)" : "rgba(156, 154, 242, 0.12)";

  return (
    <div
      className={`bg-surface border border-border rounded-lg py-2 px-3 font-sans transition-all duration-200 cursor-default relative hover:border-border-hover hover:shadow-lg ${data.connectedCount > 0 ? "" : "opacity-50"}`}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: bgColor, color }}>
          <Bolt width={14} height={14} />
        </div>
        <div className="text-xs font-semibold text-main whitespace-nowrap overflow-hidden text-ellipsis leading-snug">{data.label || data.name}</div>
      </div>

      {/* Handle — left side, receiving edges from agents */}
      <Handle type="target" position={Position.Left} className="flow-handle" />
    </div>
  );
}
