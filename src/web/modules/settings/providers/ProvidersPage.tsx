import { Key } from "@solar-icons/react";
import { useEffect, useState } from "react";
import type { LlmProvider } from "src/common/types";
import RenderIf from "src/components/ui/RenderIf";
import { Button } from "src/components/ui/button";
import { fetchLlmProviders } from "src/modules/llm-providers/common/llmProvidersSlice";
import { ProviderAddForm } from "src/modules/llm-providers/components/ProviderAddForm";
import { ProviderEmptyState } from "src/modules/llm-providers/components/ProviderEmptyState";
import { ProviderListItem } from "src/modules/llm-providers/components/ProviderListItem";
import { useAppDispatch, useAppSelector } from "src/store/store";

export function ProvidersPage() {
  const dispatch = useAppDispatch();
  const providers = useAppSelector((s) => s.llmProviders.items) as LlmProvider[];
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    setLoadingProviders(true);
    dispatch(fetchLlmProviders())
      .unwrap()
      .finally(() => setLoadingProviders(false));
  }, [dispatch]);

  return (
    <div className="flex flex-col gap-4">
      {/* Section header with inline action */}
      <RenderIf condition={!showAddForm}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-main">AI Providers</h3>
            <p className="text-[11px] text-muted mt-0.5">Configure API keys for LLM providers</p>
          </div>
          <Button id="settings-add-provider" variant="primary" size="sm" icon={<Key width={11} height={11} />} onClick={() => setShowAddForm(true)}>
            Add Provider
          </Button>
        </div>
      </RenderIf>

      {/* Add form */}
      <RenderIf condition={showAddForm}>
        <ProviderAddForm onClose={() => setShowAddForm(false)} />
      </RenderIf>

      {/* Loading */}
      <RenderIf condition={loadingProviders}>
        <div className="flex items-center justify-center h-40 gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-[${i * 150}ms]`} />
          ))}
        </div>
      </RenderIf>

      {/* Empty state */}
      <RenderIf condition={!loadingProviders && providers.length === 0 && !showAddForm}>
        <div className="rounded-xl border border-border bg-surface">
          <ProviderEmptyState onAdd={() => setShowAddForm(true)} />
        </div>
      </RenderIf>

      {/* Provider list */}
      <RenderIf condition={!loadingProviders && providers.length > 0}>
        {() => (
          <div className="flex flex-col gap-2.5">
            {providers.map((p) => (
              <ProviderListItem key={p.id} item={p} />
            ))}
          </div>
        )}
      </RenderIf>
    </div>
  );
}
