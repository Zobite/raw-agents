import { AltArrowDown, AltArrowLeft, Magnifier } from "@solar-icons/react";
import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "src/common/lib/cn";
import type { LlmProvider } from "src/common/types";
import RenderIf from "src/components/ui/RenderIf";
import { Popover, PopoverContent, PopoverTrigger } from "src/components/ui/popover";
import { useAppSelector } from "src/store/store";
import anthropicIcon from "../../../assets/icons/anthropic.svg";
import googleIcon from "../../../assets/icons/google.svg";
import ollamaIcon from "../../../assets/icons/ollama.svg";
import openaiIcon from "../../../assets/icons/openai.svg";
import openrouterIcon from "../../../assets/icons/openrouter.svg";

const PROVIDER_ICONS: Record<string, string> = {
  openai: openaiIcon,
  anthropic: anthropicIcon,
  google: googleIcon,
  ollama: ollamaIcon,
  openrouter: openrouterIcon,
};

interface InputAreaProps {
  generating: boolean;
  placeholder: string;
  onSend: (text: string) => void;
  onCancel: () => void;
  providerId?: string | null;
  model?: string;
  onProviderChange?: (id: string) => void;
  onModelChange?: (model: string) => void;
  hideConfig?: boolean;
}

export function InputArea({
  generating,
  placeholder,
  onSend,
  onCancel,
  providerId: _providerId,
  model,
  onProviderChange,
  onModelChange,
  hideConfig,
}: InputAreaProps) {
  const [text, setText] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");
  /** Which provider is "drilled into" — null = show provider list */
  const [activeProvider, setActiveProvider] = useState<LlmProvider | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasText = text.trim().length > 0;

  const providerItems = useAppSelector((s) => s.llmProviders.items) as LlmProvider[];

  // Flat list for finding current entry
  const allModels = useMemo(
    () =>
      providerItems.flatMap((p) =>
        (p.models ?? []).map((m) => ({
          model: m,
          providerType: p.provider,
          providerId: p.id,
          providerLabel: p.label,
        })),
      ),
    [providerItems],
  );

  // Current icon based on selected model
  const currentEntry = allModels.find((x) => x.model === model);
  const currentIcon = currentEntry ? PROVIDER_ICONS[currentEntry.providerType] : undefined;

  // ── Level 1: filtered providers ──────────────────────────────────────
  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return providerItems.filter((p) => (p.models ?? []).length > 0);
    return providerItems.filter((p) => (p.models ?? []).length > 0 && (p.label.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q)));
  }, [providerItems, search]);

  // ── Level 2: filtered models for the active provider ─────────────────
  const filteredModels = useMemo(() => {
    if (!activeProvider) return [];
    const q = search.trim().toLowerCase();
    const models = activeProvider.models ?? [];
    if (!q) return models;
    return models.filter((m) => m.toLowerCase().includes(q));
  }, [activeProvider, search]);

  const handleSelectModel = (p: LlmProvider, m: string) => {
    onProviderChange?.(p.id);
    onModelChange?.(m);
    setPopoverOpen(false);
    setSearch("");
    setActiveProvider(null);
  };

  const goToProvider = (p: LlmProvider) => {
    setActiveProvider(p);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const goBack = () => {
    setActiveProvider(null);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const closePopover = useCallback(() => {
    setPopoverOpen(false);
    setSearch("");
    setActiveProvider(null);
  }, []);

  const openPopover = useCallback(() => {
    setPopoverOpen(true);
    setActiveProvider(null);
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const noModel = !hideConfig && !model;
  const canSend = !generating && !noModel;
  const sendEnabled = hasText && canSend;

  const handleSend = () => {
    if (!sendEnabled) return;
    onSend(text.trim());
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={cn(
        "shrink-0 mx-2 mb-2 rounded-xl border overflow-hidden flex flex-col transition-all duration-150",
        noModel ? "bg-surface/60 border-border" : "bg-surface border-border",
      )}
    >
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        data-chat-input
        rows={1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
        }}
        onKeyDown={handleKeyDown}
        disabled={generating || noModel}
        placeholder={noModel ? "Select a model to start chatting" : placeholder}
        className={cn(
          "w-full px-3 pt-3 pb-2 border-none outline-none resize-none text-[14px] leading-relaxed min-h-[22px] max-h-[120px] overflow-auto block chat-input-textarea transition-colors bg-transparent",
          noModel ? "text-muted cursor-not-allowed placeholder:text-border-hover" : "text-main placeholder:text-muted placeholder:font-normal",
        )}
      />

      {/* Bottom toolbar */}
      <div className="flex items-center gap-1.5 pb-2 px-2">
        {/* Model picker trigger */}
        <RenderIf condition={!hideConfig}>
          <Popover
            open={popoverOpen}
            onOpenChange={(v) => {
              if (!v) closePopover();
              else openPopover();
            }}
          >
            <PopoverTrigger asChild>
              <button
                ref={triggerRef}
                type="button"
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-medium transition-all duration-150 cursor-pointer max-w-48",
                  model
                    ? "px-2 py-1 rounded-lg text-soft hover:bg-border/60 hover:text-main"
                    : "px-2 py-1 rounded-lg border border-dashed border-border-hover text-muted hover:bg-surface-raised hover:border-border-hover",
                )}
              >
                <RenderIf condition={!!model && !!currentIcon}>
                  <img src={currentIcon} alt="" className="w-3.5 h-3.5 shrink-0 opacity-80" />
                </RenderIf>
                <span className="truncate text-[11px] font-medium leading-tight">{model || "Select model"}</span>
                <AltArrowDown width={9} height={9} className="text-border-hover shrink-0" />
              </button>
            </PopoverTrigger>

            <PopoverContent side="top" align="start" className="w-72 p-0">
              <RenderIf
                condition={providerItems.length > 0}
                fallback={
                  <div className="flex flex-col justify-center items-center gap-3 px-4 py-6 text-center h-60">
                    <div className="w-9 h-9 rounded-full bg-surface-raised border border-border flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <title>No provider</title>
                        <path
                          d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 5v6m0 4h.01"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-main">No providers configured</p>
                      <p className="text-[12px] text-soft mt-0.5 leading-relaxed">Add an API key to start using models</p>
                    </div>
                  </div>
                }
              >
                <>
                  {/* Header: back button (level 2) or title (level 1) + search */}
                  <div className="px-2.5 pt-2.5 pb-2 border-b border-surface-raised">
                    <RenderIf condition={!!activeProvider}>
                      <button
                        type="button"
                        onClick={goBack}
                        className="flex items-center gap-1.5 mb-2 text-[11px] text-soft hover:text-main transition-colors cursor-pointer"
                      >
                        <AltArrowLeft width={12} height={12} />
                        <span className="font-medium">Back to providers</span>
                      </button>
                    </RenderIf>

                    <div className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg bg-background border border-border">
                      <Magnifier width={12} height={12} className="text-muted shrink-0" />
                      <input
                        ref={searchRef}
                        type="text"
                        placeholder={activeProvider ? "Search models..." : "Search providers..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-[12px] text-main placeholder:text-muted"
                      />
                    </div>
                  </div>

                  <RenderIf
                    condition={!activeProvider}
                    fallback={
                      /* ── Level 2: Models of the selected provider ────────── */
                      <div className="overflow-y-auto max-h-64 py-1.5">
                        {/* Provider name header */}
                        <div className="flex items-center gap-2 px-3 py-1.5">
                          {PROVIDER_ICONS[activeProvider?.provider ?? ""] ? (
                            <img src={PROVIDER_ICONS[activeProvider?.provider ?? ""]} alt="" className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          ) : (
                            <div className="w-3.5 h-3.5 shrink-0 rounded-full bg-border-hover" />
                          )}
                          <span className="text-[10px] font-semibold text-muted uppercase tracking-widest truncate">{activeProvider?.label}</span>
                        </div>

                        <RenderIf condition={filteredModels.length === 0}>
                          <div className="text-[12px] text-muted text-center py-4">No models found</div>
                        </RenderIf>

                        {activeProvider &&
                          filteredModels.map((m) => {
                            const isActive = m === model && activeProvider.id === currentEntry?.providerId;
                            return (
                              <button
                                key={`${activeProvider.id}::${m}`}
                                type="button"
                                onClick={() => handleSelectModel(activeProvider, m)}
                                className={cn(
                                  "w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left text-[12px] transition-all duration-100 cursor-pointer",
                                  isActive ? "bg-primary-50 text-primary font-medium" : "text-soft hover:bg-surface-raised",
                                )}
                              >
                                <RenderIf condition={isActive}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 -ml-3.5 mr-1.5" />
                                </RenderIf>
                                <span className="truncate text-[11.5px]">{m}</span>
                              </button>
                            );
                          })}
                      </div>
                    }
                  >
                    {/* ── Level 1: Provider list ───────────────────────────── */}
                    <div className="overflow-y-auto max-h-64 py-1.5">
                      <RenderIf condition={filteredProviders.length === 0}>
                        <div className="text-[12px] text-muted text-center py-4">No providers found</div>
                      </RenderIf>

                      {filteredProviders.map((p) => {
                        const icon = PROVIDER_ICONS[p.provider];
                        const modelCount = (p.models ?? []).length;
                        const isCurrentProvider = p.id === currentEntry?.providerId;

                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => goToProvider(p)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-100 cursor-pointer group",
                              isCurrentProvider ? "bg-primary-50/50" : "hover:bg-surface-raised",
                            )}
                          >
                            {icon ? (
                              <img src={icon} alt="" className="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <div className="w-4 h-4 shrink-0 rounded-full bg-border-hover" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className={cn("block text-[12px] font-medium truncate", isCurrentProvider ? "text-primary" : "text-main")}>{p.label}</span>
                              <span className="block text-[10px] text-muted mt-0.5">
                                {modelCount} model{modelCount !== 1 ? "s" : ""}
                                {isCurrentProvider && currentEntry ? ` · ${currentEntry.model}` : ""}
                              </span>
                            </div>
                            <AltArrowDown width={10} height={10} className="text-border-hover shrink-0 -rotate-90 group-hover:text-muted transition-colors" />
                          </button>
                        );
                      })}
                    </div>
                  </RenderIf>
                </>
              </RenderIf>
            </PopoverContent>
          </Popover>
        </RenderIf>

        <div className="flex-1" />

        {/* Send / Stop */}
        <RenderIf
          condition={generating}
          fallback={
            <button
              type="button"
              disabled={!sendEnabled}
              onClick={handleSend}
              title="Send (Enter)"
              className={[
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-100",
                sendEnabled
                  ? "bg-primary border border-primary-600 cursor-pointer hover:bg-primary-hover active:scale-95"
                  : "bg-border cursor-not-allowed opacity-50",
              ].join(" ")}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <title>Send</title>
                <path
                  d="M6 9.5V2.5M6 2.5L3 5.5M6 2.5L9 5.5"
                  stroke={sendEnabled ? "#1a1a1a" : "currentColor"}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          }
        >
          <button
            type="button"
            onClick={onCancel}
            title="Stop"
            className="w-7 h-7 rounded-lg bg-surface-raised border border-border-hover flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 active:scale-95 transition-all duration-100"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <title>Stop</title>
              <rect x="1" y="1" width="7" height="7" rx="1.5" fill="currentColor" />
            </svg>
          </button>
        </RenderIf>
      </div>
    </div>
  );
}
