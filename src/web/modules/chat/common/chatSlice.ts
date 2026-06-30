import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient } from "src/common/api";
import type { AgentConversation, AgentMessage, NewAgentMessage } from "src/common/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedMessage extends AgentMessage {
  convTitle: string;
  convTrigger: AgentConversation["trigger"];
  convCreatedAt: Date | null;
}

export interface IChatState {
  conversations: AgentConversation[];
  messages: AgentMessage[];
  activeConversationId: string | null;
  loading: boolean;
}

const initialState: IChatState = {
  conversations: [],
  messages: [],
  activeConversationId: null,
  loading: false,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchConversations = createAsyncThunk("chat/fetchConversations", async (agentId: string) => {
  const result = await apiClient.get<{ items: AgentConversation[] }>(`/api/conversations${agentId ? `?agentId=${agentId}` : ""}`);
  return result.items;
});

export const createConversation = createAsyncThunk(
  "chat/createConversation",
  async (data: {
    agentId: string;
    title?: string;
    trigger?: "manual" | "cron" | "api" | "meeting" | "public";
    ownerId?: string;
  }) => {
    const conv = await apiClient.post<AgentConversation>("/api/conversations", {
      agentId: data.agentId,
      title: data.title ?? "New Chat",
      trigger: data.trigger ?? "manual",
      ownerId: data.ownerId,
    });
    return conv;
  },
);

export const updateConversation = createAsyncThunk(
  "chat/updateConversation",
  async ({ id, ...data }: { id: string } & Partial<Pick<AgentConversation, "title" | "status" | "finishedAt" | "errorMessage">>) => {
    await apiClient.put(`/api/conversations/${id}`, data);
    return { id, ...data };
  },
);

export const deleteConversation = createAsyncThunk("chat/deleteConversation", async (id: string) => {
  await apiClient.delete(`/api/conversations/${id}`);
  return id;
});

export const fetchMessages = createAsyncThunk("chat/fetchMessages", async (conversationId: string) => {
  const rows = await apiClient.get<AgentMessage[]>(`/api/conversations/${conversationId}/messages`);
  return rows;
});

export const saveMessage = createAsyncThunk(
  "chat/saveMessage",
  async (
    data: Omit<NewAgentMessage, "id" | "conversationId"> & {
      conversationId?: string;
    },
    { getState },
  ) => {
    const state = getState() as { chat: IChatState };
    const convId = data.conversationId ?? state.chat.activeConversationId ?? undefined;
    if (!convId) throw new Error("No active conversation");
    const msg = await apiClient.post<AgentMessage>(`/api/conversations/${convId}/messages`, {
      ...data,
      conversationId: convId,
    });
    return msg;
  },
);

export const updateMessageMetadata = createAsyncThunk(
  "chat/updateMessageMetadata",
  async ({ id, patch }: { id: string; patch: Record<string, unknown> }, { getState }) => {
    const state = getState() as { chat: IChatState };
    const msg = state.chat.messages.find((m) => m.id === id);
    if (!msg?.conversationId) return;
    await apiClient.patch(`/api/conversations/${msg.conversationId}/messages/${id}/metadata`, patch);
  },
);

export const loadAgentFeed = createAsyncThunk("chat/loadAgentFeed", async ({ agentId, cursor }: { agentId: string; cursor?: Date }) => {
  const result = await apiClient.get<{ items: FeedMessage[]; hasMore: boolean }>(
    `/api/conversations/feed/messages?agentId=${agentId}${cursor ? `&cursor=${cursor.toISOString()}` : ""}`,
  );
  return result;
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setActiveConversationId(state, { payload }: { payload: string | null }) {
      state.activeConversationId = payload;
      if (payload === null) state.messages = [];
    },
    pushMessages(state, { payload }: { payload: AgentMessage[] }) {
      state.messages.push(...payload);
    },
    markConversationDone(state, { payload }: { payload: string }) {
      const now = new Date();
      const conv = state.conversations.find((c) => c.id === payload);
      if (conv) {
        conv.status = "done";
        conv.finishedAt = now as any;
      }
    },
    clearMessages(state) {
      state.messages = [];
    },
    upsertConversationLocal(state, { payload }: { payload: AgentConversation }) {
      const idx = state.conversations.findIndex((c) => c.id === payload.id);
      if (idx >= 0) {
        state.conversations[idx] = {
          ...state.conversations[idx],
          ...payload,
        };
      } else {
        state.conversations.unshift(payload);
      }
    },
    removeConversationLocal(state, { payload }: { payload: string }) {
      state.conversations = state.conversations.filter((c) => c.id !== payload);
      if (state.activeConversationId === payload) {
        state.activeConversationId = state.conversations[0]?.id ?? null;
        state.messages = [];
      }
    },
    upsertMessageLocal(state, { payload }: { payload: AgentMessage }) {
      if (payload.conversationId !== state.activeConversationId) return;
      const idx = state.messages.findIndex((m) => m.id === payload.id);
      if (idx >= 0) {
        state.messages[idx] = { ...state.messages[idx], ...payload };
      } else {
        state.messages.push(payload);
      }
    },
    resetConversations(state) {
      state.conversations = [];
      state.activeConversationId = null;
      state.messages = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchConversations
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
        state.loading = false;
      })
      .addCase(fetchConversations.rejected, (state) => {
        state.loading = false;
      })
      // createConversation
      .addCase(createConversation.fulfilled, (state, action) => {
        state.conversations.unshift(action.payload);
      })
      // updateConversation
      .addCase(updateConversation.fulfilled, (state, action) => {
        const { id, ...data } = action.payload;
        const conv = state.conversations.find((c) => c.id === id);
        if (conv) Object.assign(conv, data);
      })
      // deleteConversation
      .addCase(deleteConversation.fulfilled, (state, action) => {
        const id = action.payload;
        state.conversations = state.conversations.filter((c) => c.id !== id);
        if (state.activeConversationId === id) {
          state.activeConversationId = state.conversations[0]?.id ?? null;
          state.messages = [];
        }
      })
      // fetchMessages
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.messages = action.payload;
        state.loading = false;
      })
      .addCase(fetchMessages.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const {
  setActiveConversationId,
  pushMessages,
  markConversationDone,
  clearMessages,
  upsertConversationLocal,
  removeConversationLocal,
  upsertMessageLocal,
  resetConversations,
} = chatSlice.actions;

export const chatReducer = chatSlice.reducer;
export default chatReducer;
