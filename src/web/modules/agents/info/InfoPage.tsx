import { useEffect, useState } from "react";

import type { LlmProvider } from "src/common/types";
import RenderIf from "src/components/ui/RenderIf";
import { Button } from "src/components/ui/button";

import { Input } from "src/components/ui/input";
import { Field } from "src/components/ui/label";
import { ModelPicker } from "src/components/ui/model-picker";
import { Textarea } from "src/components/ui/textarea";
import { fetchLlmProviders } from "src/modules/llm-providers/common/llmProvidersSlice";
import { useAppDispatch, useAppSelector } from "src/store/store";
import { updateAgent } from "../common/agentsSlice";

import { useAgentDetailContext } from "../common/agentDetailContext";

export function InfoPage() {
  const { id, name, setName, description, setDescription, selectedProviderId, onProviderChange, aiModel, setAiModel } = useAgentDetailContext();

  const dispatch = useAppDispatch();
  const providers = useAppSelector((s) => s.llmProviders.items) as LlmProvider[];
  const loaded = useAppSelector((s) => s.llmProviders.items.length > 0 || s.llmProviders.total === 0);

  const [savingInfo, setSavingInfo] = useState(false);
  // Track original values to detect dirty state
  const [origName, setOrigName] = useState(name);
  const [origDesc, setOrigDesc] = useState(description);

  // Sync originals when agent data loads
  useEffect(() => {
    setOrigName(name);
    setOrigDesc(description);
  }, [id]);

  useEffect(() => {
    dispatch(fetchLlmProviders());
  }, [dispatch]);

  const infoDirty = name !== origName || description !== origDesc;

  // ── Auto-save helpers ────────────────────────────────────────────────────

  const handleSaveInfo = async () => {
    if (!id || !name.trim()) return;
    setSavingInfo(true);
    try {
      await dispatch(updateAgent({ id, name: name.trim(), description: description.trim() || undefined }));
      setOrigName(name.trim());
      setOrigDesc(description.trim());
    } finally {
      setSavingInfo(false);
    }
  };

  const handleModelChange = (providerId: string, model: string) => {
    onProviderChange(providerId);
    setAiModel(model);
    if (id) dispatch(updateAgent({ id, aiProvider: providerId, aiModel: model }));
  };

  const cardClass = "relative rounded-xl border bg-surface p-6 shadow-card";
  const highlightLine = "absolute top-0 left-8 right-8 h-px bg-linear-to-r from-transparent via-border to-transparent";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[600px] mx-auto px-6 py-8 flex flex-col gap-6">
        {/* ── Basic Info Card ── */}
        <div className={cardClass}>
          <div className={highlightLine} />
          <div className="flex flex-col gap-4">
            <Field label="Agent Name" required>
              <Input id="agent-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Market Analyst" autoComplete="off" />
            </Field>

            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of what this agent does"
                autoHeight
                rows={5}
              />
            </Field>

            <div className="flex justify-end">
              <Button size="sm" disabled={!infoDirty || !name.trim()} loading={savingInfo} onClick={handleSaveInfo}>
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* ── AI Model Card ── */}
        <div className={cardClass}>
          <div className={highlightLine} />
          <div className="flex flex-col gap-4">
            <Field label="Model" required>
              <ModelPicker
                providers={providers}
                selectedProviderId={selectedProviderId}
                selectedModel={aiModel}
                onChange={handleModelChange}
                loaded={loaded}
                disabled={!loaded}
              />
            </Field>

            <RenderIf condition={loaded && providers.length === 0}>
              <div className="text-xs text-danger font-medium px-3 py-2 bg-danger/8 rounded-lg border border-danger/20">
                No AI Provider available. Go to <strong>Settings → API Providers</strong> to add one.
              </div>
            </RenderIf>
          </div>
        </div>
      </div>
    </div>
  );
}
