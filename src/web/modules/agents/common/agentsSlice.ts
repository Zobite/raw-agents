import type { Agent } from "src/common/types";
import { BaseReducer, type IBaseState } from "src/store/baseSlice";

// ─── State ────────────────────────────────────────────────────────────────────

export interface IAgentsState extends IBaseState {
  filter: {
    page: number;
    limit: number;
    sorts?: string;
    search?: string;
  };
}

const initialState: IAgentsState = {
  total: 0,
  items: [] as Agent[],
  selected: [],
  filter: {
    page: 1,
    limit: 200,
    sorts: "-createdAt",
  },
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const { actions: _actions, reducer: agentsReducer } = new BaseReducer<IAgentsState>({
  name: "agents",
  basePath: "/api/agents",
  initialState,
}).createSlice();

export const {
  fetchItems: fetchAgents,
  getItem: fetchOneAgent,
  createItem: createAgent,
  updateItem: updateAgent,
  deleteItem: deleteAgent,
  updateFilter: updateAgentsFilter,
  upsertLocal: upsertAgentLocal,
  removeLocal: removeAgentLocal,
} = _actions as any;

export { agentsReducer };
export default agentsReducer;
