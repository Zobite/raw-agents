import { AltArrowLeft, Magnifier } from "@solar-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LlmProvider } from "src/common/types";
import { cn } from "src/lib/utils";
import { PROVIDER_META } from "src/modules/llm-providers/common/llmProvidersSlice";
import { ProviderIcon } from "src/modules/llm-providers/components/ProviderIcon";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// ─── ModelPicker ──────────────────────────────────────────────────────────────
// Two-level popover: Level 1 = providers, Level 2 = models of selected provider.
// If already selected, opens directly into the provider's model list.

interface ModelPickerProps {
  providers: LlmProvider[];
  selectedProviderId: string | null;
  selectedModel: string;
  onChange: (providerId: string, model: string) => void;
  disabled?: boolean;
  loaded?: boolean;
  placeholder?: string;
}

type View = { level: "providers" } | { level: "models"; providerId: string };

export function ModelPicker({
  providers,
  selectedProviderId,
  selectedModel,
  onChange,
  disabled = false,
  loaded = true,
  placeholder = "Select model…",
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ level: "providers" });
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // When popover opens, decide which view to show
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setSearch("");
        // If already selected a provider, go directly to its models
        if (selectedProviderId) {
          setView({ level: "models", providerId: selectedProviderId });
        } else {
          setView({ level: "providers" });
        }
      }
      setOpen(nextOpen);
    },
    [selectedProviderId],
  );

  // Focus search when entering models view
  useEffect(() => {
    if (open && view.level === "models") {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open, view]);

  // Derive display values
  const selectedProvider = providers.find((p) => p.id === selectedProviderId) ?? null;
  const providerMeta = selectedProvider ? PROVIDER_META[selectedProvider.provider] : null;

  // Current view provider (for level 2)
  const viewProvider = view.level === "models" ? (providers.find((p) => p.id === view.providerId) ?? null) : null;
  const viewProviderMeta = viewProvider ? PROVIDER_META[viewProvider.provider] : null;
  const viewModels = viewProvider?.models ?? [];
  const filteredModels = search ? viewModels.filter((m) => m.toLowerCase().includes(search.toLowerCase())) : viewModels;

  // Reset focused index when search changes or filtered results change
  useEffect(() => {
    setFocusedIndex(0);
  }, [search]);

  // Scroll focused item into view
  useEffect(() => {
    if (listRef.current && focusedIndex >= 0) {
      const items = listRef.current.querySelectorAll<HTMLButtonElement>("[data-model-item]");
      items[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < filteredModels.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredModels.length > 0 && focusedIndex >= 0 && focusedIndex < filteredModels.length) {
        handleSelectModel(filteredModels[focusedIndex]);
      }
    }
  };

  const handleSelectProvider = (providerId: string) => {
    setSearch("");
    setView({ level: "models", providerId });
  };

  const handleSelectModel = (model: string) => {
    if (view.level === "models") {
      onChange(view.providerId, model);
      setOpen(false);
    }
  };

  const handleBack = () => {
    setSearch("");
    setView({ level: "providers" });
  };

  // ── Trigger button label ──
  const triggerContent =
    selectedProvider && selectedModel ? (
      <span className="flex items-center gap-2 min-w-0">
        <ProviderIcon provider={selectedProvider.provider} size={14} />
        <span className="text-muted text-xs shrink-0">{providerMeta?.label ?? selectedProvider.label}</span>
        <span className="text-muted/40 shrink-0">/</span>
        <span className="text-main truncate font-mono text-xs">{selectedModel}</span>
      </span>
    ) : (
      <span className="text-muted">{!loaded ? "Loading…" : placeholder}</span>
    );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full h-field-md px-3 rounded-md text-sm text-left",
            "bg-surface border border-border",
            "flex items-center justify-between gap-2",
            "transition-all duration-150 cursor-pointer outline-none",
            open ? "border-primary" : "hover:border-border-hover",
            disabled && "bg-surface-raised text-muted border-border cursor-not-allowed",
          )}
        >
          {triggerContent}
          <svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("shrink-0 text-muted transition-transform duration-150", open && "rotate-180")}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden">
        {view.level === "providers" ? (
          /* ══ Level 1: Providers ══ */
          <div className="flex flex-col h-96">
            <div className="px-3 py-2.5 border-b border-border">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Select Provider</span>
            </div>
            <div onWheel={(e) => e.stopPropagation()} className="flex-1 min-h-0 overflow-y-auto py-1 game-scrollbar">
              {providers.map((p) => {
                const isActive = p.id === selectedProviderId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProvider(p.id)}
                    className={cn(
                      "w-full px-3 py-2 text-sm text-left flex items-center gap-2.5 transition-colors duration-100 cursor-pointer",
                      isActive ? "bg-primary-50 text-primary" : "text-soft hover:bg-surface-raised",
                    )}
                  >
                    <div className="w-6 h-6 rounded-md bg-surface-raised border border-border flex items-center justify-center shrink-0">
                      <ProviderIcon provider={p.provider} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-medium truncate block", isActive && "text-primary")}>{p.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(p.models?.length ?? 0) > 0 && (
                        <span className="text-[10px] text-muted bg-surface-raised rounded-full px-1.5 py-0.5 font-medium">{p.models.length}</span>
                      )}
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-muted">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </button>
                );
              })}
              {providers.length === 0 && (
                <div className="px-3 py-6 text-xs text-muted text-center">
                  No providers available.
                  <br />
                  <span className="text-muted/60">Go to Settings → API Providers</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ══ Level 2: Models ══ */
          <div className="flex flex-col h-96">
            {/* Header with back button */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <button
                type="button"
                onClick={handleBack}
                className="w-6 h-6 rounded-md flex items-center justify-center text-muted hover:text-main hover:bg-surface-raised transition-colors cursor-pointer"
              >
                <AltArrowLeft size={14} />
              </button>
              {viewProvider && (
                <div className="flex items-center gap-2 min-w-0">
                  <ProviderIcon provider={viewProvider.provider} size={14} />
                  <span className="text-xs font-semibold text-main truncate">{viewProviderMeta?.label ?? viewProvider.label}</span>
                </div>
              )}
            </div>

            {/* Search */}
            {viewModels.length > 5 && (
              <div className="px-2.5 py-2 border-b border-border">
                <div className="relative">
                  <Magnifier size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search models…"
                    className="w-full h-7 pl-7 pr-2.5 rounded-md text-xs bg-surface border border-border text-main placeholder:text-muted outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Model list */}
            <div ref={listRef} onWheel={(e) => e.stopPropagation()} className="flex-1 min-h-0 overflow-y-auto py-1 game-scrollbar">
              {filteredModels.map((m, idx) => {
                const isActive = m === selectedModel && view.level === "models" && view.providerId === selectedProviderId;
                const isFocused = idx === focusedIndex;
                return (
                  <button
                    key={m}
                    type="button"
                    data-model-item
                    onClick={() => handleSelectModel(m)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={cn(
                      "w-full px-3 py-[7px] text-left text-xs font-mono truncate transition-colors duration-100 cursor-pointer",
                      isActive ? "bg-primary-50 text-primary font-medium" : isFocused ? "bg-surface-raised text-main" : "text-soft hover:bg-surface-raised",
                    )}
                    title={m}
                  >
                    {m}
                  </button>
                );
              })}
              {filteredModels.length === 0 && (
                <div className="px-3 py-4 text-xs text-muted text-center">{search ? "No models match your search" : "No models available"}</div>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
