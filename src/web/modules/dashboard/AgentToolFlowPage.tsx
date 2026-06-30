// ─── Agent-Tool Flow Dashboard ───────────────────────────────────────────────
// Route: / — Visual mapping of agents ↔ tools using React Flow.
// Tools on the left column, Agents on the right, edges connect them.

import { Background, BackgroundVariant, type Edge, type Node, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Agent, AgentTool, AgentToolAssignment } from "src/common/types";
import { fetchAgents } from "src/modules/agents/common/agentsSlice";
import { fetchTools } from "src/modules/tools/common/toolsSlice";
import { useAppDispatch, useAppSelector } from "src/store/store";
import { AgentNode, type AgentNodeType } from "./nodes/AgentNode";
import { ToolNode, type ToolNodeType } from "./nodes/ToolNode";
import "./flowStyles.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_GAP_Y = 170; // vertical spacing between agent nodes (~155px tall)
const TOOL_GAP_Y = 60; // vertical spacing between tool nodes (~40px tall)
const AGENT_COL_X = 60; // agents column x position (left)
const TOOLS_COL_X = 500; // tools column x position (right)
const START_Y = 50; // y position for first node

// ─── Node Types ──────────────────────────────────────────────────────────────

const nodeTypes = {
  tool: ToolNode,
  agent: AgentNode,
};

// ─── Agent color palette for edges ──────────────────────────────────────────

const EDGE_COLORS = [
  "#a8ff53", // primary lime
  "#9c9af2", // lavender
  "#ff6b9d", // pink
  "#64d2ff", // sky blue
  "#ffb347", // orange
  "#7ee8d0", // mint
  "#ff8a80", // coral
  "#b388ff", // purple
  "#82b1ff", // light blue
  "#ccff90", // light green
];

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchAllAssignments(agents: Agent[]): Promise<Map<string, AgentToolAssignment[]>> {
  const map = new Map<string, AgentToolAssignment[]>();
  const results = await Promise.all(
    agents.map(async (agent) => {
      try {
        const res = await fetch(`/api/agents/${agent.id}/tool-assignments`);
        const assignments: AgentToolAssignment[] = await res.json();
        return { agentId: agent.id, assignments };
      } catch {
        return { agentId: agent.id, assignments: [] };
      }
    }),
  );
  for (const { agentId, assignments } of results) {
    map.set(agentId, assignments);
  }
  return map;
}

// ─── Inner Component (needs ReactFlowProvider ancestor) ─────────────────────

function AgentToolFlowInner() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const agents = useAppSelector((s) => s.agents.items) as Agent[];
  const tools = useAppSelector((s) => s.tools.items) as AgentTool[];

  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, AgentToolAssignment[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Track whether the initial redux data fetch has completed
  const [dataReady, setDataReady] = useState(false);

  // Track which agent IDs we've already fetched assignments for to prevent duplicates
  const fetchedAgentIdsRef = useRef<string>("");

  // Fetch base data once on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([dispatch(fetchAgents()), dispatch(fetchTools())]).finally(() => {
      if (!cancelled) setDataReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Once data is ready, fetch assignments (or finish loading if no agents)
  useEffect(() => {
    if (!dataReady) return;

    // No agents → nothing to fetch, just stop loading
    if (agents.length === 0) {
      setLoading(false);
      return;
    }

    // Build a stable key from current agent IDs to prevent refetching the same set
    const agentIdsKey = agents
      .map((a) => a.id)
      .sort()
      .join(",");
    if (fetchedAgentIdsRef.current === agentIdsKey) return;
    fetchedAgentIdsRef.current = agentIdsKey;

    let cancelled = false;
    setLoading(true);

    fetchAllAssignments(agents)
      .then((map) => {
        if (!cancelled) {
          setAssignmentsMap(map);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch tool assignments:", err);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataReady, agents]);

  // Build the tool→agentCount map (how many agents use each tool)
  const toolAgentCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [, assignments] of assignmentsMap) {
      for (const a of assignments) {
        counts.set(a.toolId, (counts.get(a.toolId) ?? 0) + 1);
      }
    }
    return counts;
  }, [assignmentsMap]);

  // Build the agent→toolCount map
  const agentToolCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [agentId, assignments] of assignmentsMap) {
      counts.set(agentId, assignments.length);
    }
    return counts;
  }, [assignmentsMap]);

  // ─── Build Nodes ────────────────────────────────────────────────────────────

  const nodes = useMemo(() => {
    const result: Node[] = [];

    // Agent nodes — left vertical column
    agents.forEach((agent, i) => {
      const node: AgentNodeType = {
        id: `agent-${agent.id}`,
        type: "agent",
        position: { x: AGENT_COL_X, y: START_Y + i * AGENT_GAP_Y },
        data: {
          name: agent.name,
          description: agent.description,
          color: "#7aaee8",
          aiModel: agent.aiModel,
          runStatus: agent.runStatus,
          toolCount: agentToolCount.get(agent.id) ?? 0,
        },
      };
      result.push(node);
    });

    // Tool nodes — right vertical column (builtin first, then custom)
    const sortedTools = [...tools].sort((a, b) => {
      if (a.isBuiltin === b.isBuiltin) return 0;
      return a.isBuiltin ? -1 : 1;
    });

    sortedTools.forEach((tool, i) => {
      const node: ToolNodeType = {
        id: `tool-${tool.id}`,
        type: "tool",
        position: { x: TOOLS_COL_X, y: START_Y + i * TOOL_GAP_Y },
        data: {
          label: tool.label,
          name: tool.name,
          description: tool.description?.slice(0, 60) + (tool.description?.length > 60 ? "…" : "") || "",
          isBuiltin: tool.isBuiltin,
          connectedCount: toolAgentCount.get(tool.id) ?? 0,
        },
      };
      result.push(node);
    });

    return result;
  }, [tools, agents, toolAgentCount, agentToolCount]);

  // ─── Build Edges ────────────────────────────────────────────────────────────

  const edges = useMemo(() => {
    const result: Edge[] = [];

    for (const [agentId, assignments] of assignmentsMap) {
      const agent = agents.find((a) => a.id === agentId);
      const edgeColor = EDGE_COLORS[agents.indexOf(agent!) % EDGE_COLORS.length] ?? "#a8ff53";

      for (const assignment of assignments) {
        result.push({
          id: `edge-${assignment.toolId}-${agentId}`,
          source: `agent-${agentId}`,
          target: `tool-${assignment.toolId}`,
          animated: true,
          style: {
            stroke: edgeColor,
            strokeWidth: 2,
            opacity: 0.6,
          },
        });
      }
    }

    return result;
  }, [assignmentsMap, agents]);

  // ─── Node click handler ─────────────────────────────────────────────────────

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("agent-")) {
        const agentId = node.id.replace("agent-", "");
        navigate(`/agents/${agentId}`);
      } else if (node.id.startsWith("tool-")) {
        const toolId = node.id.replace("tool-", "");
        navigate(`/tools/${toolId}`);
      }
    },
    [navigate],
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading graph…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* React Flow Canvas */}
      <div className="flex-1 agent-tool-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: "default",
            animated: true,
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}

// ─── Exported Component (with ReactFlowProvider) ────────────────────────────

export default function AgentToolFlowPage() {
  return (
    <ReactFlowProvider>
      <AgentToolFlowInner />
    </ReactFlowProvider>
  );
}
