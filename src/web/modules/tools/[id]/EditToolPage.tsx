// ─── Edit Tool Page ───────────────────────────────────────────────────────────
// Route: /tools/:id — Full-page editor for a single tool.
// Layout: Header bar → [ Code editor (left) | Sidebar (right) ]

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "src/common/api";
import { SettingKey } from "src/common/enum";
import type { AgentTool } from "src/common/types";
import type { ToolSet } from "src/common/types/tool";
import type { ChatAgentMessage, ToolActionEvent } from "src/components/chat/ChatAgent";
import { type EditorInstance, MonacoEditor } from "src/components/ui/MonacoEditor";
import { useAppDispatch, useAppSelector } from "src/store/store";

import { AI_SYSTEM_PROMPT } from "../common/constants";
import {
  FETCH_WEBPAGE_TOOL_NAME,
  RUN_CURRENT_SCRIPT_TOOL_NAME,
  UPDATE_EDITOR_CODE_TOOL_NAME,
  fetchWebpageToolStub,
  makeRunCurrentScriptTool,
  updateEditorCodeTool,
} from "../common/editorTools";
import type { EditorUpdate } from "../common/editorTypes";
import { deleteTool, fetchTools, updateTool } from "../common/toolsSlice";
import { buildJsonSchemaFromCode, injectMetaIntoCode, injectParamsIntoCode, parseMetaFromCode, parseParams } from "../common/utils";

import { EditToolHeader } from "./components/EditToolHeader";
import type { RunPanelHandle } from "./components/RunPanel";
import { SidebarPanel } from "./components/SidebarPanel";
import { ValidationBanner } from "./components/ValidationBanner";

export default function EditToolPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // ── Fetch tool ──
  const [tool, setTool] = useState<AgentTool | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setTool(undefined);
    setLoading(true);
    apiClient
      .get<AgentTool>(`/api/tools/${id}`)
      .then((tool) => setTool(tool))
      .catch(() => setTool(undefined))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Code state ──
  const [localCode, setLocalCode] = useState("");
  const [savedCode, setSavedCode] = useState("");
  const [sharedCode, setSharedCode] = useState("");
  const editorRef = useRef<EditorInstance | null>(null);
  const codeRef = useRef(localCode);
  codeRef.current = localCode;
  const currentLoadedToolIdRef = useRef<string | null>(null);

  // ── Load code when tool is fetched ──
  useEffect(() => {
    if (!tool || currentLoadedToolIdRef.current === tool.id) return;
    let code = injectParamsIntoCode(tool.codeContent ?? "", parseParams(tool));
    code = injectMetaIntoCode(code, {
      label: tool.label,
      description: tool.description,
    });
    setLocalCode(code);
    setSavedCode(code);
    setSharedCode(code);
    currentLoadedToolIdRef.current = tool.id;
  }, [tool]);

  // ── Save + delete state ──
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isDirty = localCode !== savedCode;

  // ── Annotation validation ──
  const codeMeta = useMemo(() => parseMetaFromCode(localCode), [localCode]);
  const codeValidationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!codeMeta.label) errors.push("@name");
    if (!codeMeta.description) errors.push("@description");
    const codeLines = localCode.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    if (codeLines.length === 0) errors.push("code body");
    if (!/\breturn\b/.test(localCode)) errors.push("return statement");
    return errors;
  }, [codeMeta, localCode]);
  const hasValidationErrors = codeValidationErrors.length > 0;
  const [showValidationError, setShowValidationError] = useState(false);

  useEffect(() => {
    if (!hasValidationErrors) setShowValidationError(false);
  }, [hasValidationErrors]);

  // ── Provider / model (persisted) ──
  const providerItems = useAppSelector((s) => s.llmProviders.items);
  const providersLoaded = useAppSelector((s) => s.llmProviders.items.length > 0 || s.llmProviders.total === 0);
  const settings = useAppSelector((s) => s.settings.data);
  const [providerId, setProviderId] = useState<string | undefined>(undefined);
  const [model, setModel] = useState("");
  const initializedRef = useRef(false);

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

  // ── AI chat messages ──
  const messagesRef = useRef<ChatAgentMessage[]>([]);

  // ── Editor tools (FE-only) ──
  const editorTools: ToolSet = useMemo(
    () => ({
      [UPDATE_EDITOR_CODE_TOOL_NAME]: updateEditorCodeTool,
      [RUN_CURRENT_SCRIPT_TOOL_NAME]: makeRunCurrentScriptTool(() => codeRef.current),
      [FETCH_WEBPAGE_TOOL_NAME]: fetchWebpageToolStub,
    }),
    [],
  );

  // ── System prompt ──
  const systemPrompt = [
    AI_SYSTEM_PROMPT,
    localCode.trim()
      ? `\nCurrent code in editor (AI is working based on this):\n\`\`\`python\n${localCode}\n\`\`\``
      : "\nEditor is currently empty — please write new code.",
  ].join("\n");

  // ── Apply AI code via executeEdits ──
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
  const runPanelRef = useRef<RunPanelHandle>(null);

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
    [applyUpdate],
  );

  // ── Active toggle ──
  const isActive = tool?.isActive ?? false;
  const [toggling, setToggling] = useState(false);

  const handleToggleActive = useCallback(async () => {
    if (!id || toggling) return;
    if (!isActive && hasValidationErrors) {
      setShowValidationError(true);
      return;
    }
    setToggling(true);
    try {
      await dispatch(updateTool({ id, isActive: !isActive })).unwrap();
      setTool((prev) => (prev ? { ...prev, isActive: !isActive } : prev));
    } finally {
      setToggling(false);
    }
  }, [id, isActive, toggling, dispatch, hasValidationErrors]);

  // ── Save ──
  const handleSave = async () => {
    if (!id) return;
    if (hasValidationErrors) {
      setShowValidationError(true);
      return;
    }
    if (!isDirty) return;
    setSaving(true);
    try {
      const meta = parseMetaFromCode(localCode);
      await dispatch(
        updateTool({
          id,
          parameters: buildJsonSchemaFromCode(localCode),
          codeContent: localCode,
          ...(meta.label ? { label: meta.label } : {}),
          ...(meta.name ? { name: meta.name } : {}),
          ...(meta.description ? { description: meta.description } : {}),
        }),
      ).unwrap();
      setSavedCode(localCode);
      setTool((prev) =>
        prev
          ? {
              ...prev,
              ...(meta.label ? { label: meta.label } : {}),
              ...(meta.description ? { description: meta.description } : {}),
            }
          : prev,
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = useCallback(async () => {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      await dispatch(deleteTool(id)).unwrap();
      await dispatch(fetchTools());
      navigate("/tools");
    } finally {
      setDeleting(false);
    }
  }, [id, deleting, dispatch, navigate]);

  const toolLabel = parseMetaFromCode(localCode).label || tool?.label || "Untitled Tool";

  // ── Loading / Not found states ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted font-medium">Loading tool…</span>
        </div>
      </div>
    );
  }

  if (!loading && id && !tool) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-raised flex items-center justify-center">
            <span className="text-xl">🔧</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-main mb-1">Tool not found</p>
            <p className="text-xs text-muted">This tool may have been deleted.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/tools")}
            className="text-xs font-semibold text-primary hover:text-primary-hover cursor-pointer bg-transparent border-0 underline underline-offset-2"
          >
            Back to Tools
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top bar */}
      <EditToolHeader
        label={toolLabel}
        toolId={id}
        isActive={isActive}
        toggling={toggling}
        deleting={deleting}
        saving={saving}
        isDirty={isDirty}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onSave={handleSave}
      />

      {/* Validation error banner */}
      {showValidationError && hasValidationErrors && <ValidationBanner errors={codeValidationErrors} onDismiss={() => setShowValidationError(false)} />}

      {/* Body: Code editor + Sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Monaco editor */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <MonacoEditor
            language="python"
            theme="neon-dark"
            loadingBg="#121317"
            value={localCode}
            onChange={(v) => {
              const next = v ?? "";
              setLocalCode(next);
              setSharedCode(next);
            }}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            options={{ fontSize: 13, tabSize: 2 }}
          />
        </div>

        {/* Right: Sidebar */}
        <SidebarPanel
          providerId={providerId}
          model={model}
          systemPrompt={systemPrompt}
          editorTools={editorTools}
          messagesRef={messagesRef}
          sharedCode={sharedCode}
          toolId={id}
          runPanelRef={runPanelRef}
          onToolAction={handleToolAction}
          onChangeAiProvider={(pid) => {
            setProviderId(pid);
            setModel("");
            void apiClient.patch("/api/settings", {
              [SettingKey.ToolAssistantProvider]: pid,
            });
          }}
          onChangeModel={(m) => {
            setModel(m);
            void apiClient.patch("/api/settings", {
              [SettingKey.ToolAssistantModel]: m,
            });
          }}
          onMessagesUpdate={(msgs) => {
            messagesRef.current = msgs;
          }}
        />
      </div>
    </div>
  );
}
