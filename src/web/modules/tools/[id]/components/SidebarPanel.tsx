import { motion } from "framer-motion";
import { useRef, useState } from "react";
import type { ToolSet } from "src/common/types/tool";
import type { ChatAgentMessage, ToolActionEvent } from "src/components/chat/ChatAgent";
import { ChatAgent } from "src/components/chat/ChatAgent";
import { SIDEBAR_TABS, type SidebarTabId } from "../../common/constants";
import type { RunPanelHandle } from "./RunPanel";
import { TestTab } from "./TestTab";

const SIDEBAR_DEFAULT = 380;
const SIDEBAR_MIN = 280;
const SIDEBAR_MAX = 560;

interface SidebarPanelProps {
  providerId: string | undefined;
  model: string;
  systemPrompt: string;
  editorTools: ToolSet;
  messagesRef: React.MutableRefObject<ChatAgentMessage[]>;
  sharedCode: string;
  toolId?: string;
  runPanelRef: React.RefObject<RunPanelHandle | null>;
  onToolAction: (event: ToolActionEvent) => void;
  onChangeAiProvider: (pid: string) => void;
  onChangeModel: (m: string) => void;
  onMessagesUpdate: (msgs: ChatAgentMessage[]) => void;
}

export function SidebarPanel({
  providerId,
  model,
  systemPrompt,
  editorTools,
  messagesRef,
  sharedCode,
  toolId,
  runPanelRef,
  onToolAction,
  onChangeAiProvider,
  onChangeModel,
  onMessagesUpdate,
}: SidebarPanelProps) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTabId>("agent");
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, startW: 0 });

  // Attach drag listeners once
  const handleDragMouseMove = (e: MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = dragRef.current.startX - e.clientX;
    setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragRef.current.startW + dx)));
  };

  const handleDragMouseUp = () => {
    if (dragRef.current.active) {
      dragRef.current.active = false;
      setIsDragging(false);
      document.removeEventListener("mousemove", handleDragMouseMove);
      document.removeEventListener("mouseup", handleDragMouseUp);
    }
  };

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startW: sidebarWidth };
    setIsDragging(true);
    document.addEventListener("mousemove", handleDragMouseMove);
    document.addEventListener("mouseup", handleDragMouseUp);
  };

  return (
    <>
      {/* Drag handle */}
      <div
        onMouseDown={startDrag}
        className={[
          "w-[3px] shrink-0 h-full cursor-col-resize z-10 transition-colors duration-150",
          isDragging ? "bg-primary/50" : "bg-transparent hover:bg-primary/25",
        ].join(" ")}
      />

      {/* Sidebar */}
      <div className="shrink-0 flex flex-col border-border bg-surface overflow-hidden" style={{ width: sidebarWidth }}>
        {/* Tab bar */}
        <div className="shrink-0 px-2 pt-2 pb-1.5 border-b border-border">
          <div className="relative flex items-center bg-surface-raised rounded-lg p-0.5">
            <motion.div
              className="absolute top-0.5 bottom-0.5 rounded-md bg-primary/15 border border-primary/20"
              layoutId="sidebar-tab-pill"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
              style={{
                left: `calc(${SIDEBAR_TABS.findIndex((t) => t.id === sidebarTab) * (100 / SIDEBAR_TABS.length)}% + 2px)`,
                width: `calc(${100 / SIDEBAR_TABS.length}% - 4px)`,
              }}
            />
            {SIDEBAR_TABS.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setSidebarTab(tabId)}
                className={[
                  "relative z-10 flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold tracking-wide cursor-pointer rounded-md bg-transparent border-0 transition-colors",
                  sidebarTab === tabId ? "text-primary" : "text-muted hover:text-soft",
                ].join(" ")}
              >
                <Icon size={11} className={sidebarTab === tabId ? "text-primary" : "text-muted"} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content — all mounted, toggle visibility */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Agent — AI Chat */}
          <div className={["h-full overflow-hidden", sidebarTab === "agent" ? "flex flex-col" : "hidden"].join(" ")}>
            <ChatAgent
              aiProviderId={providerId}
              aiModel={model}
              messages={messagesRef.current}
              systemPrompt={systemPrompt}
              tools={editorTools}
              maxSteps={12}
              showProviderPicker
              assistantLabel="AI Assistant"
              placeholder="Describe request... (Enter to send)"
              onToolAction={onToolAction}
              onFinish={(msgs) => onMessagesUpdate(msgs)}
              onClear={() => onMessagesUpdate([])}
              onChangeAiProvider={onChangeAiProvider}
              onChangeModel={onChangeModel}
              className="h-full rounded-none border-none"
            />
          </div>

          {/* Test — Run panel */}
          <div className={["h-full overflow-hidden", sidebarTab === "test" ? "flex flex-col" : "hidden"].join(" ")}>
            <TestTab code={sharedCode} toolId={toolId} runPanelRef={runPanelRef} />
          </div>
        </div>
      </div>
    </>
  );
}
