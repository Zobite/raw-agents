import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiClient } from "src/common/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppSettings = Record<string, string>;

export interface ISettingsState {
  data: AppSettings;
  loaded: boolean;
}

const initialState: ISettingsState = {
  data: {},
  loaded: false,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchSettings = createAsyncThunk("settings/fetch", async () => {
  const data = await apiClient.get<AppSettings>("/api/settings");
  return data;
});

export const saveSettings = createAsyncThunk("settings/save", async (patch: AppSettings) => {
  await apiClient.patch("/api/settings", patch);
  return patch;
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    // Optimistic local update (used by save before await completes)
    patchSettingsLocal(state, { payload }: { payload: AppSettings }) {
      state.data = { ...state.data, ...payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.data = action.payload;
        state.loaded = true;
      })
      .addCase(fetchSettings.rejected, (state) => {
        state.loaded = true;
      })
      .addCase(saveSettings.pending, (state, action) => {
        // Optimistic update
        state.data = { ...state.data, ...action.meta.arg };
      })
      .addCase(saveSettings.rejected, (_state, action) => {
        console.error("[Settings] save failed:", action.error);
      });
  },
});

export const { patchSettingsLocal } = settingsSlice.actions;
export const settingsReducer = settingsSlice.reducer;
export default settingsReducer;
