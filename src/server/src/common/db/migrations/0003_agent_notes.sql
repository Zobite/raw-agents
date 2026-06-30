-- Agent Notes: long-form markdown documents per agent
CREATE TABLE IF NOT EXISTS agent_notes (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
