import { Bolt } from "@solar-icons/react";

import type { AgentToolAssignment } from "src/common/types";
import { useAgentDetailContext } from "../common/agentDetailContext";
import { CallAgentSection } from "./components/CallAgentSection";
import { EmptyToolsNotice } from "./components/EmptyToolsNotice";
import { ToolRow } from "./components/ToolRow";
import type { ToolEntry } from "./components/ToolRow";

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = "/api";

async function apiAddAssignment(agentId: string, toolId: string): Promise<AgentToolAssignment> {
  const res = await fetch(`${API}/agents/${agentId}/tool-assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolId }),
  });
  return res.json();
}

async function apiFetchAssignments(agentId: string): Promise<AgentToolAssignment[]> {
  const res = await fetch(`${API}/agents/${agentId}/tool-assignments`);
  return res.json();
}

async function apiRemoveAssignment(agentId: string, assignmentId: string): Promise<void> {
  await fetch(`${API}/agents/${agentId}/tool-assignments/${assignmentId}`, { method: "DELETE" });
}

async function apiReplaceAssignments(agentId: string, items: { toolId: string }[]): Promise<AgentToolAssignment[]> {
  const res = await fetch(`${API}/agents/${agentId}/tool-assignments`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return res.json();
}

async function apiUpdateCallableAgents(agentId: string, callableAgentIds: string[]): Promise<void> {
  await fetch(`${API}/agents/${agentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callableAgentIds }),
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ToolsPage() {
  const { id, toolAssignments, setToolAssignments, callableAgentIds, setCallableAgentIds, allTools, agents } = useAgentDetailContext();

  const agentId = id ?? "";

  const ALWAYS_ON = new Set(["update_agent_memory", "manage_agent_note"]);
  const toolCatalog: ToolEntry[] = allTools
    .filter((t) => t.isActive && t.name !== "call_agent" && !ALWAYS_ON.has(t.name))
    .map((t) => ({
      id: t.id,
      name: t.name,
      label: t.label,
      description: t.description ?? "",
      isBuiltin: t.isBuiltin,
    }));

  const callAgentTool = allTools.find((t) => t.name === "call_agent");
  const callAgentToolId = callAgentTool?.id;

  const assignedToolIds = toolAssignments.filter((a) => a.tool.name !== "call_agent").map((a) => a.toolId);

  const isCallAgentEnabled = toolAssignments.some((a) => a.tool.name === "call_agent");

  const toggleTool = async (toolId: string) => {
    if (!agentId) return;
    const existing = toolAssignments.find((a) => a.toolId === toolId);
    if (existing) {
      // Remove assignment
      setToolAssignments(toolAssignments.filter((a) => a.id !== existing.id));
      await apiRemoveAssignment(agentId, existing.id);
    } else {
      // Add assignment
      const tool = allTools.find((t) => t.id === toolId);
      if (!tool) return;
      const tempAssignment: AgentToolAssignment = {
        id: `temp-${crypto.randomUUID()}`,
        agentId,
        toolId,
        createdAt: new Date(),
        tool: { name: tool.name, label: tool.label, description: tool.description, isBuiltin: tool.isBuiltin },
      };
      setToolAssignments([...toolAssignments, tempAssignment]);
      await apiAddAssignment(agentId, toolId);
      const fresh = await apiFetchAssignments(agentId);
      setToolAssignments(fresh);
    }
  };

  // ── Toggle call_agent tool ──────────────────────────────────────────────────

  const toggleCallAgent = async () => {
    if (!agentId || !callAgentToolId) return;
    if (isCallAgentEnabled) {
      const existing = toolAssignments.find((a) => a.tool.name === "call_agent");
      setToolAssignments(toolAssignments.filter((a) => a.tool.name !== "call_agent"));
      if (existing) await apiRemoveAssignment(agentId, existing.id);
    } else {
      const tempAssignment: AgentToolAssignment = {
        id: `temp-${crypto.randomUUID()}`,
        agentId,
        toolId: callAgentToolId,
        createdAt: new Date(),
        tool: { name: "call_agent", label: "Call Agent", description: "Delegates a task to another agent", isBuiltin: true },
      };
      setToolAssignments([...toolAssignments, tempAssignment]);
      await apiAddAssignment(agentId, callAgentToolId);
      const fresh = await apiFetchAssignments(agentId);
      setToolAssignments(fresh);
    }
  };

  // ── Toggle callable agent ───────────────────────────────────────────────────

  const toggleCallableAgent = async (targetAgentId: string) => {
    if (!agentId) return;
    const next = callableAgentIds.includes(targetAgentId) ? callableAgentIds.filter((cid) => cid !== targetAgentId) : [...callableAgentIds, targetAgentId];
    setCallableAgentIds(next);
    await apiUpdateCallableAgents(agentId, next);
  };

  const toggleAll = async () => {
    if (!agentId) return;
    // Keep call_agent assignment untouched
    const callAgentAssignment = toolAssignments.find((a) => a.tool.name === "call_agent");

    if (assignedToolIds.length === toolCatalog.length) {
      // Deselect all regular tools
      const items = callAgentAssignment ? [{ toolId: callAgentAssignment.toolId }] : [];
      setToolAssignments(callAgentAssignment ? [callAgentAssignment] : []);
      const result = await apiReplaceAssignments(agentId, items);
      setToolAssignments(result);
    } else {
      // Select all regular tools
      const allItems: { toolId: string }[] = toolCatalog.map((t) => ({ toolId: t.id }));
      if (callAgentAssignment) {
        allItems.push({ toolId: callAgentAssignment.toolId });
      }
      // Optimistic
      const tempAll: AgentToolAssignment[] = toolCatalog.map((t) => ({
        id: `temp-${crypto.randomUUID()}`,
        agentId,
        toolId: t.id,
        createdAt: new Date(),
        tool: { name: t.name, label: t.label, description: t.description, isBuiltin: t.isBuiltin },
      }));
      if (callAgentAssignment) tempAll.push(callAgentAssignment);
      setToolAssignments(tempAll);
      const result = await apiReplaceAssignments(agentId, allItems);
      setToolAssignments(result);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto game-scrollbar">
      <div className="max-w-[620px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-[32px] h-[32px] rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-50 border border-primary-300">
              <Bolt className="w-[16px] h-[16px] text-primary-700" />
            </div>
            <div className="pr-2">
              <div className="text-md font-bold text-main">AI Tools</div>
              <div className="text-xs text-muted">
                Select tools the AI can <strong>use during conversations</strong>.
              </div>
            </div>
          </div>

          {toolCatalog.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className={[
                "text-xs font-semibold mt-1 ml-1 flex-shrink-0 cursor-pointer bg-transparent border-none p-0 whitespace-nowrap",
                assignedToolIds.length === toolCatalog.length ? "text-danger" : "text-primary",
              ].join(" ")}
            >
              {assignedToolIds.length === toolCatalog.length ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        <div className="pt-6">
          <div className="flex flex-col gap-6">
            {/* Regular tools list */}
            {toolCatalog.length === 0 ? (
              <EmptyToolsNotice />
            ) : (
              <div className="flex flex-col gap-2">
                {toolCatalog.map((tool) => (
                  <ToolRow key={tool.id} tool={tool} checked={assignedToolIds.includes(tool.id)} onToggle={() => toggleTool(tool.id)} />
                ))}
              </div>
            )}

            {/* ── Call Agent Section ─────────────────────────────────── */}
            <div className="border-t border-border pt-4">
              <div className="text-2xs font-bold uppercase tracking-[0.08em] text-muted mb-2.5">Agent Delegation</div>
              <CallAgentSection
                currentAgentId={id}
                agents={agents}
                callAgentToolId={callAgentToolId}
                isCallAgentEnabled={isCallAgentEnabled}
                onToggleCallAgent={toggleCallAgent}
                callableAgentIds={callableAgentIds}
                onToggleCallableAgent={toggleCallableAgent}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
