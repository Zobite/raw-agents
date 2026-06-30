/** Payload from AI when calling update_editor_code */
export interface EditorUpdate {
  code: string;
  summary?: string;
}

export interface ToolCodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  /** Callback for AI to apply new code + highlight diff */
  onApplyUpdate?: (update: EditorUpdate) => void;
  height?: string;
  toolId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool-call" | "tool-result" | "error";
  content: string;
  toolName?: string;
  /** Input params when calling tool */
  toolInput?: unknown;
  /** Output/result from tool (after running) */
  toolOutput?: string;
  streaming?: boolean;
  timestamp: Date;
}
