import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { RefObject } from "react";
import { SettingKey } from "src/common/enum";

import { apiClient } from "src/common/api";
import type { AgentTool } from "src/common/types";
import { AgentEditor, type EditorInstance, type ToolActionEvent } from "src/components/ui/agent_editor";
import { fetchLlmProviders } from "src/modules/llm-providers/common/llmProvidersSlice";
import { useAppDispatch, useAppSelector } from "src/store/store";
import { AI_SYSTEM_PROMPT } from "../../common/constants";
import {
  FETCH_WEBPAGE_TOOL_NAME,
  RUN_CURRENT_SCRIPT_TOOL_NAME,
  UPDATE_EDITOR_CODE_TOOL_NAME,
  fetchWebpageToolStub,
  makeRunCurrentScriptTool,
  updateEditorCodeTool,
} from "../../common/editorTools";
import type { EditorUpdate } from "../../common/editorTypes";
import { fetchTools, updateTool } from "../../common/toolsSlice";
import { buildJsonSchemaFromCode, injectParamsIntoCode, parseParams } from "../../common/utils";
import type { RunPanelHandle } from "./RunPanel";

interface CodeTabProps {
  toolId?: string;
  runPanelRef: RefObject<RunPanelHandle | null>;
  onCodeChange?: (code: string) => void;
  /** Called whenever dirty/saving state changes so the parent can render a shared Save button */
  onDirtyChange?: (dirty: boolean) => void;
  /** Parent calls this to trigger save imperatively */
  onSaveRef?: RefObject<(() => Promise<void>) | null>;
}

export function CodeTab({ toolId, runPanelRef, onCodeChange, onDirtyChange, onSaveRef }: CodeTabProps) {
  const dispatch = useAppDispatch();
  const storeTools = useAppSelector((s) => s.tools.items) as AgentTool[];

  const [localCode, setLocalCode] = useState("");
  const [savedCode, setSavedCode] = useState("");

  const currentLoadedToolIdRef = useRef<string | null>(null);
  const editorRef = useRef<EditorInstance | null>(null);
  const codeRef = useRef(localCode);
  codeRef.current = localCode;

  // ── Provider / model (persisted) ──
  const providerItems = useAppSelector((s) => s.llmProviders.items);
  const providersLoaded = useAppSelector((s) => s.llmProviders.items.length > 0 || s.llmProviders.total === 0);
  const settings = useAppSelector((s) => s.settings.data);
  const [providerId, setProviderId] = useState<string | undefined>(undefined);
  const [model, setModel] = useState("");
  const initializedRef = useRef(false);

  useEffect(() => {
    dispatch(fetchLlmProviders());
  }, [dispatch]);

  useEffect(() => {
    if (!providersLoaded || providerItems.length === 0) return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    const savedProvider = settings[SettingKey.ToolAssistantProvider] ?? "";
    const savedModel = settings[SettingKey.ToolAssistantModel] ?? "";
    const match = providerItems.find((p) => p.id === savedProvider) ?? providerItems[0];
    setProviderId(match.id);
    setModel(savedModel);
  }, [providersLoaded, providerItems, settings]);

  useEffect(() => {
    dispatch(fetchTools());
  }, [dispatch]);

  useEffect(() => {
    if (!toolId || currentLoadedToolIdRef.current === toolId) return;
    const tool = storeTools.find((t) => t.id === toolId);
    if (!tool) return;
    const injected = injectParamsIntoCode(tool.codeContent ?? "", parseParams(tool));
    setLocalCode(injected);
    setSavedCode(injected);
    onCodeChange?.(injected);
    currentLoadedToolIdRef.current = toolId;
  }, [storeTools, toolId, onCodeChange]);

  const isDirty = localCode !== savedCode;

  // Notify parent about dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // ── Editor tools (FE-only) ──
  const editorTools = useMemo(
    () => ({
      [UPDATE_EDITOR_CODE_TOOL_NAME]: updateEditorCodeTool,
      [RUN_CURRENT_SCRIPT_TOOL_NAME]: makeRunCurrentScriptTool(() => codeRef.current),
      [FETCH_WEBPAGE_TOOL_NAME]: fetchWebpageToolStub,
    }),
    [],
  );

  // ── System prompt (injects current code context) ──
  const systemPrompt = [
    AI_SYSTEM_PROMPT,
    localCode.trim()
      ? `\nCurrent code in editor (AI is working based on this):\n\`\`\`python\n${localCode}\n\`\`\``
      : "\nEditor is currently empty — please write new code.",
  ].join("\n");

  // ── Apply AI code via executeEdits (preserves undo history) ──
  const applyUpdate = useCallback((upd: EditorUpdate) => {
    const editor = editorRef.current;
    const monacoModel = editor?.getModel();
    if (!editor || !monacoModel) {
      setLocalCode(upd.code);
      return;
    }
    if (upd.code === monacoModel.getValue()) {
      setLocalCode(upd.code);
      return;
    }
    editor.pushUndoStop();
    editor.executeEdits("ai-update", [{ range: monacoModel.getFullModelRange(), text: upd.code }]);
    editor.pushUndoStop();
    setLocalCode(upd.code);
  }, []);

  // ── Handle tool actions from AI ──
  const handleToolAction = useCallback(
    (event: ToolActionEvent) => {
      if (event.toolName === UPDATE_EDITOR_CODE_TOOL_NAME) {
        if (event.type === "tool-call") {
          const input = event.input as { code: string; summary?: string };
          if (input?.code) applyUpdate({ code: input.code, summary: input.summary });
        }
      } else if (event.toolName === RUN_CURRENT_SCRIPT_TOOL_NAME) {
        if (event.type === "tool-call") {
          runPanelRef.current?.setRunning(true);
        } else if (event.type === "tool-result") {
          const out = event.output as any;
          runPanelRef.current?.setExternalResult({
            ok: out?.success ?? false,
            output: out?.output,
            error: out?.error,
            console: out?.console,
          });
        }
      }
    },
    [applyUpdate, runPanelRef],
  );

  const handleSave = async () => {
    if (!toolId || !isDirty) return;
    try {
      await dispatch(
        updateTool({
          id: toolId,
          parameters: buildJsonSchemaFromCode(localCode),
          codeContent: localCode,
        }),
      ).unwrap();
      setSavedCode(localCode);
    } catch {
      // save failed silently
    }
  };

  // Expose save fn imperatively — placed after handleSave to avoid used-before-declaration
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useEffect(() => {
    if (onSaveRef) {
      (onSaveRef as React.MutableRefObject<(() => Promise<void>) | null>).current = () => handleSaveRef.current();
    }
  }, [onSaveRef]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* ── AgentEditor: Monaco + resizable AI sidebar ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AgentEditor
          language="python"
          value={localCode}
          onChange={(v) => {
            const next = v ?? "";
            setLocalCode(next);
            onCodeChange?.(next);
          }}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
          monacoOptions={{ fontSize: 13, tabSize: 2 }}
          systemPrompt={systemPrompt}
          tools={editorTools}
          aiProviderId={providerId}
          aiModel={model}
          onToolAction={handleToolAction}
          onChangeAiProvider={(id) => {
            setProviderId(id);
            setModel("");
            void apiClient.patch("/api/settings", {
              [SettingKey.ToolAssistantProvider]: id,
            });
          }}
          onChangeModel={(m) => {
            setModel(m);
            void apiClient.patch("/api/settings", {
              [SettingKey.ToolAssistantModel]: m,
            });
          }}
          assistantLabel="AI Assistant"
          chatPlaceholder="Describe request... (Enter to send)"
          sidebarDefaultWidth={440}
        />
      </div>
    </div>
  );
}
