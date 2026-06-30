// ─── Agent Detail Page ────────────────────────────────────────────────────────
// Route: /agents/:id/* — Full-screen agent detail with sidebar + routed tabs.

import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { Agent, AgentTool, AgentToolAssignment } from "src/common/types";
import { fetchLlmProviders } from "src/modules/llm-providers/common/llmProvidersSlice";
import { fetchTools } from "src/modules/tools/common/toolsSlice";
import { useAppDispatch, useAppSelector } from "src/store/store";
import { ChatPage } from "./chat/ChatPage";
import { AgentSidebar } from "./chat/components/AgentSidebar";
import { type AgentDetailContext, AgentDetailCtx } from "./common/agentDetailContext";
import { deleteAgent, fetchAgents, fetchOneAgent } from "./common/agentsSlice";

import { ConfigPage } from "./config/ConfigPage";
import { InfoPage } from "./info/InfoPage";
import { PromptPage } from "./prompt/PromptPage";
import { PublishPage } from "./publish/PublishPage";
import { ToolsPage } from "./tools/ToolsPage";

// ─── API helpers ───────────────────────────────────────────────────────────────

const API_BASE = "/api";

async function fetchAssignments(agentId: string): Promise<AgentToolAssignment[]> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/tool-assignments`);
  return res.json();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const agents = useAppSelector((s) => s.agents.items) as Agent[];
  const allTools = useAppSelector((s) => s.tools.items) as AgentTool[];

  // ── Detail form state ──────────────────────────────────────────────────────
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [toolAssignments, setToolAssignments] = useState<AgentToolAssignment[]>([]);
  const [callableAgentIds, setCallableAgentIds] = useState<string[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [publicPassword, setPublicPassword] = useState("");

  // Reset on agent change
  useEffect(() => {
    setLoaded(false);
  }, [id]);

  // Fetch agent + assignments
  useEffect(() => {
    if (!id) return;
    dispatch(fetchOneAgent(id));
    dispatch(fetchAgents());
    fetchAssignments(id).then((a) => setToolAssignments(a));
  }, [id, dispatch]);

  // Fetch tools + providers
  useEffect(() => {
    dispatch(fetchTools());
    dispatch(fetchLlmProviders());
  }, [dispatch]);

  // Hydrate form state from store
  useEffect(() => {
    if (loaded || !id) return;
    const ag = agents.find((a) => a.id === id);
    if (!ag) return;

    setName(ag.name);
    setDescription(ag.description ?? "");
    setTeamId((ag as typeof ag & { teamId?: string | null }).teamId ?? null);
    setSystemPrompt(ag.systemPrompt ?? "");
    setAiModel(ag.aiModel ?? "");
    setIsPublic(ag.isPublic ?? false);
    setPublicPassword(ag.publicPassword ?? "");
    setCallableAgentIds(ag.callableAgentIds ?? []);
    if (ag.aiProvider) setSelectedProviderId(ag.aiProvider);
    setLoaded(true);
  }, [agents, id, loaded]);

  const handleProviderChange = useCallback((pid: string | null) => setSelectedProviderId(pid), []);

  const handleBack = useCallback(() => {
    navigate("/agents");
  }, [navigate]);

  const handleDelete = async () => {
    if (!id) return;
    await dispatch(deleteAgent(id));
    navigate("/agents");
  };

  // Find current agent from store
  const agent = agents.find((a) => a.id === id);

  // Loading / not found states
  if (!id) {
    return <Navigate to="/agents" replace />;
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-muted">Loading agent…</div>
      </div>
    );
  }

  // ── Context ────────────────────────────────────────────────────────────────

  const ctxValue: AgentDetailContext = {
    id,
    agent,
    name,
    setName,
    description,
    setDescription,
    teamId,
    setTeamId,
    selectedProviderId,
    onProviderChange: handleProviderChange,
    aiModel,
    setAiModel,
    systemPrompt,
    setSystemPrompt,
    isPublic,
    setIsPublic,
    publicPassword,
    setPublicPassword,
    toolAssignments,
    setToolAssignments,
    callableAgentIds,
    setCallableAgentIds,
    allTools,
    agents,
    onDelete: handleDelete,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AgentDetailCtx.Provider value={ctxValue}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="shrink-0 w-[280px] border-r border-border bg-surface overflow-y-auto">
          <AgentSidebar agent={agent} onClose={handleBack} />
        </div>

        {/* Content — routed tabs */}
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <Routes>
            <Route index element={<Navigate to="chat" replace />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="info" element={<InfoPage />} />
            <Route path="prompt" element={<PromptPage />} />
            <Route path="tools" element={<ToolsPage />} />
            <Route path="publish" element={<PublishPage />} />
            <Route path="config" element={<ConfigPage />} />
          </Routes>
        </div>
      </div>
    </AgentDetailCtx.Provider>
  );
}
