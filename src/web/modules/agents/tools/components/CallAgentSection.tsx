import { Plain3 } from "@solar-icons/react";

import { useAppSelector } from "src/store/store";
import type { AgentDetailContext } from "../../common/agentDetailContext";
import { AgentRow } from "./AgentRow";

export function CallAgentSection({
  currentAgentId,
  agents,
  isCallAgentEnabled,
  onToggleCallAgent,
  callableAgentIds,
  onToggleCallableAgent,
}: {
  currentAgentId: string | undefined;
  agents: AgentDetailContext["agents"];
  callAgentToolId: string | undefined;
  isCallAgentEnabled: boolean;
  onToggleCallAgent: () => void;
  callableAgentIds: string[];
  onToggleCallableAgent: (agentId: string) => void;
}) {
  const teams = useAppSelector((s) => s.teams.teams);

  const otherAgents = agents.filter((a) => a.id !== currentAgentId);

  const toggleAgent = (agentId: string) => {
    onToggleCallableAgent(agentId);
  };

  const selectAll = () => {
    for (const a of otherAgents) {
      if (!callableAgentIds.includes(a.id)) {
        onToggleCallableAgent(a.id);
      }
    }
  };

  const deselectAll = () => {
    for (const a of otherAgents) {
      if (callableAgentIds.includes(a.id)) {
        onToggleCallableAgent(a.id);
      }
    }
  };

  const allSelected = otherAgents.length > 0 && callableAgentIds.length === otherAgents.length;

  // Group agents by team
  const grouped: {
    teamId: string | null;
    teamName: string;
    agentList: typeof otherAgents;
  }[] = [];
  const seenTeamIds = new Set<string | null>();

  for (const agent of otherAgents) {
    const tid = agent.teamId ?? null;
    if (!seenTeamIds.has(tid)) {
      seenTeamIds.add(tid);
      const teamName = tid ? (teams.find((t) => t.id === tid)?.name ?? "Team") : "No team";
      grouped.push({ teamId: tid, teamName, agentList: [] });
    }
    grouped.find((g) => g.teamId === tid)?.agentList.push(agent);
  }

  // Sort: teams first (alphabetical), then "No team" last
  grouped.sort((a, b) => {
    if (a.teamId === null) return 1;
    if (b.teamId === null) return -1;
    return a.teamName.localeCompare(b.teamName);
  });

  return (
    <div
      className={[
        "rounded-md border transition-all duration-[120ms]",
        isCallAgentEnabled ? "border-primary-300 bg-primary-50" : "border-border bg-surface",
      ].join(" ")}
    >
      {/* Header toggle row */}
      <button type="button" onClick={onToggleCallAgent} className="flex items-center gap-3 px-4 py-3.5 w-full text-left cursor-pointer">
        {/* Icon */}
        <div
          className={[
            "w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 transition-all",
            isCallAgentEnabled ? "bg-primary" : "bg-surface-raised",
          ].join(" ")}
        >
          <Plain3 className={["w-4 h-4 transition-colors", isCallAgentEnabled ? "text-white" : "text-muted"].join(" ")} />
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className={["text-md font-bold leading-[1.3] transition-colors", isCallAgentEnabled ? "text-primary-800" : "text-main"].join(" ")}>
            Call Agent
          </div>
          <div className="text-xs text-muted leading-[1.4] mt-0.5">Delegate tasks to other agents</div>
        </div>

        {/* Toggle switch */}
        <div
          className={["w-9 h-5 rounded-full transition-colors duration-200 relative flex-shrink-0", isCallAgentEnabled ? "bg-primary" : "bg-border-hover"].join(
            " ",
          )}
        >
          <div
            className={[
              "absolute top-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
              isCallAgentEnabled ? "translate-x-[18px]" : "translate-x-[2px]",
            ].join(" ")}
          />
        </div>
      </button>

      {/* Agent list — shown when toggle is ON */}
      {isCallAgentEnabled && (
        <div className="px-4 pb-4 border-t border-primary-200 pt-4">
          {otherAgents.length === 0 ? (
            <div className="text-center py-5 text-xs text-muted">No other agents available. Create more agents to enable delegation.</div>
          ) : (
            <>
              {/* Sub-header */}
              <div className="flex items-center justify-between mb-3.5">
                <p className="text-xs text-soft leading-[1.5]">
                  Select agents this AI can <strong>delegate tasks</strong> to.
                </p>
                <button
                  type="button"
                  onClick={allSelected ? deselectAll : selectAll}
                  className={[
                    "text-xs font-semibold ml-3 flex-shrink-0 cursor-pointer bg-transparent border-none p-0 whitespace-nowrap",
                    allSelected ? "text-danger" : "text-primary",
                  ].join(" ")}
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>

              {/* Grouped agent list */}
              <div className="flex flex-col gap-3.5">
                {grouped.map((group) => (
                  <div key={group.teamId ?? "__no_team__"}>
                    {/* Group header */}
                    <div className="mb-1.5">
                      <span className={["text-2xs font-bold uppercase tracking-[0.07em]", group.teamId ? "text-primary" : "text-muted"].join(" ")}>
                        {group.teamName}
                      </span>
                    </div>

                    {/* Agent rows */}
                    <div className="flex flex-col gap-1.5">
                      {group.agentList.map((agent) => (
                        <AgentRow key={agent.id} agent={agent} checked={callableAgentIds.includes(agent.id)} onToggle={() => toggleAgent(agent.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted mt-4 leading-[1.5]">
                💡 The AI uses <code className="bg-surface-raised px-1 rounded-xs text-xs">call_agent</code> tool with the selected agents' IDs during
                conversations.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
