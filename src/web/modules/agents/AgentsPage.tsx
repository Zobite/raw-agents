// ─── Agents Page ─────────────────────────────────────────────────────────────
// Route: /agents — Full agent management page with card grid view, grouped by team.

import { AddCircle } from "@solar-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Agent, AgentToolAssignment } from "src/common/types";
import RenderIf from "src/components/ui/RenderIf";
import { Button } from "src/components/ui/button";
import { fetchAgents } from "src/modules/agents/common/agentsSlice";
import { NewAgentPopover } from "src/modules/agents/components/NewAgentDialog";
import { fetchTeams } from "src/modules/teams/common/teamsSlice";
import type { TeamWithMembers } from "src/modules/teams/common/teamsSlice";
import { useAppDispatch, useAppSelector } from "src/store/store";
import AgentGroup from "./components/AgentGroup";

// ─── Fetch all tool assignments for every agent ─────────────────────────────

async function fetchAllToolCounts(agents: Agent[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const results = await Promise.all(
    agents.map(async (agent) => {
      try {
        const res = await fetch(`/api/agents/${agent.id}/tool-assignments`);
        const assignments: AgentToolAssignment[] = await res.json();
        return { agentId: agent.id, count: assignments.length };
      } catch {
        return { agentId: agent.id, count: 0 };
      }
    }),
  );
  for (const { agentId, count } of results) {
    map.set(agentId, count);
  }
  return map;
}

// ─── Agents Page ────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const agents = useAppSelector((s) => s.agents.items) as Agent[];
  const teams = useAppSelector((s) => s.teams.teams) as TeamWithMembers[];

  const [toolCountMap, setToolCountMap] = useState<Map<string, number>>(new Map());
  const fetchedAgentIdsRef = useRef<string>("");

  useEffect(() => {
    dispatch(fetchAgents());
    dispatch(fetchTeams());
  }, [dispatch]);

  // Fetch tool counts when agents change
  useEffect(() => {
    if (agents.length === 0) return;

    const agentIdsKey = agents
      .map((a) => a.id)
      .sort()
      .join(",");
    if (fetchedAgentIdsRef.current === agentIdsKey) return;
    fetchedAgentIdsRef.current = agentIdsKey;

    fetchAllToolCounts(agents).then(setToolCountMap).catch(console.error);
  }, [agents]);

  // Sort agents by creation date (newest first)
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [agents]);

  // Group agents by team
  const groupedAgents = useMemo(() => {
    const teamMap = new Map<string, { team: TeamWithMembers; agents: Agent[] }>();

    // Initialize groups for each team
    for (const team of teams) {
      teamMap.set(team.id, { team, agents: [] });
    }

    const ungrouped: Agent[] = [];

    for (const agent of sortedAgents) {
      if (agent.teamId && teamMap.has(agent.teamId)) {
        teamMap.get(agent.teamId)?.agents.push(agent);
      } else {
        ungrouped.push(agent);
      }
    }

    // Return teams that have agents first, then ungrouped
    const groups: { key: string; title: string; agents: Agent[] }[] = [];

    for (const [teamId, { team, agents: teamAgents }] of teamMap) {
      if (teamAgents.length > 0) {
        groups.push({ key: teamId, title: team.name, agents: teamAgents });
      }
    }

    // Sort team groups alphabetically by name
    groups.sort((a, b) => a.title.localeCompare(b.title));

    if (ungrouped.length > 0) {
      groups.push({ key: "ungrouped", title: "Ungrouped", agents: ungrouped });
    }

    return groups;
  }, [sortedAgents, teams]);

  const handleNavigate = (id: string) => {
    navigate(`/agents/${id}`);
  };

  return (
    <div className="py-8 px-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-main m-0 leading-tight">Agents</h1>
          <p className="text-sm text-soft mt-1.5">Manage your AI agents </p>
        </div>
        <NewAgentPopover>
          <Button variant="primary" size="md" icon={<AddCircle width={16} height={16} />}>
            New Agent
          </Button>
        </NewAgentPopover>
      </div>

      {/* Grouped Agent Cards */}
      <div className="max-w-6xl mx-auto flex  flex-col gap-10">
        <RenderIf
          condition={agents.length > 0}
          fallback={
            <div className="text-center py-15 px-5 text-sm text-muted bg-surface border border-border rounded-xl">
              <p>No agents yet. Create your first agent to get started.</p>
            </div>
          }
        >
          {groupedAgents.map((group) => (
            <AgentGroup key={group.key} title={group.title} agents={group.agents} toolCountMap={toolCountMap} onNavigate={handleNavigate} />
          ))}
        </RenderIf>
      </div>
    </div>
  );
}
