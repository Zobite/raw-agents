-- Agent Tools: custom tool definitions
CREATE TABLE IF NOT EXISTS agent_tools (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  description  TEXT NOT NULL,
  icon         TEXT,
  parameters   TEXT NOT NULL DEFAULT '{"type":"object","properties":{},"required":[]}',
  code_content TEXT NOT NULL,
  is_builtin   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Agent Tool Assignments: maps agents <-> tools with per-assignment config
CREATE TABLE IF NOT EXISTS agent_tool_assignments (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool_id    TEXT NOT NULL REFERENCES agent_tools(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
