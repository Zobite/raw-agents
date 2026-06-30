// ─── Dashboard Page ──────────────────────────────────────────────────────────
// Route: / — Overview stats: agents, teams, tools.

import { Bolt, Plain3, UsersGroupTwoRounded } from "@solar-icons/react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Agent, AgentTool } from "src/common/types";
import { fetchAgents } from "src/modules/agents/common/agentsSlice";
import { fetchTeams } from "src/modules/teams/common/teamsSlice";
import type { TeamWithMembers } from "src/modules/teams/common/teamsSlice";
import { fetchTools } from "src/modules/tools/common/toolsSlice";
import { useAppDispatch, useAppSelector } from "src/store/store";

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex flex-col gap-2 p-5 bg-surface border border-border rounded-xl text-left cursor-pointer transition-all duration-200 hover:border-border-hover hover:bg-surface-raised group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-sm font-medium text-soft">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
          {icon}
        </div>
      </div>
      <span className="text-3xl font-bold text-main leading-none">{value}</span>
    </button>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const agents = useAppSelector((s) => s.agents.items) as Agent[];
  const teams = useAppSelector((s) => s.teams.teams) as TeamWithMembers[];
  const tools = useAppSelector((s) => s.tools.items) as AgentTool[];

  useEffect(() => {
    dispatch(fetchAgents());
    dispatch(fetchTeams());
    dispatch(fetchTools());
  }, [dispatch]);

  return (
    <div className="py-8 px-10">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-main m-0 leading-[1.2]">Dashboard</h1>
        <p className="text-md text-soft mt-1.5">Overview of your agents, tools, and teams</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mb-8">
        <StatCard
          label="Agents"
          value={agents.length}
          icon={<Plain3 width={20} height={20} />}
          color="rgba(168,255,83,0.15)"
          onClick={() => navigate("/agents")}
        />
        <StatCard
          label="Teams"
          value={teams.length}
          icon={<UsersGroupTwoRounded width={20} height={20} />}
          color="rgba(156,154,242,0.15)"
          onClick={() => navigate("/agents")}
        />
        <StatCard label="Tools" value={tools.length} icon={<Bolt width={20} height={20} />} color="rgba(215,217,221,0.15)" onClick={() => navigate("/tools")} />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2.5 mb-8">
        <button
          type="button"
          className="flex items-center gap-2 py-[9px] px-4 bg-surface border border-border rounded-full text-sm font-medium text-soft cursor-pointer transition-all duration-150 ease-in-out hover:bg-surface-raised hover:border-border-hover hover:text-main"
          onClick={() => navigate("/agents")}
        >
          <Plain3 width={16} height={16} />
          <span>Manage Agents</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-2 py-[9px] px-4 bg-surface border border-border rounded-full text-sm font-medium text-soft cursor-pointer transition-all duration-150 ease-in-out hover:bg-surface-raised hover:border-border-hover hover:text-main"
          onClick={() => navigate("/tools")}
        >
          <Bolt width={16} height={16} />
          <span>Manage Tools</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-2 py-[9px] px-4 bg-primary/10 border border-primary/20 rounded-full text-sm font-medium text-primary cursor-pointer transition-all duration-150 ease-in-out hover:bg-primary/15 hover:border-primary/30"
          onClick={() => navigate("/dashboard/flow")}
        >
          <span>⚡</span>
          <span>Agent ↔ Tool Map</span>
        </button>
      </div>
    </div>
  );
}
