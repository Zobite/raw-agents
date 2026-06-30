# Raw Agents

Self-hosted AI Agent Manager with a beautiful web UI. Create, manage and schedule autonomous AI agents powered by multiple LLM providers.

![License](https://img.shields.io/badge/license-MIT-blue)
![Runtime](https://img.shields.io/badge/runtime-Bun-f472b6)
![Version](https://img.shields.io/npm/v/raw-agents)

## Features

- 🤖 **Multi-Agent Management** — Create and configure multiple AI agents with different personas and tools
- 🧠 **Multi-Provider** — OpenAI, Anthropic, Google Gemini, OpenRouter and more via LangChain
- 🛠️ **Custom Tools** — Give agents custom tools (JavaScript / Python) to interact with the world
- ⏰ **Scheduled Tasks** — Cron-based task scheduling for automated agent runs
- 💬 **Real-time Chat** — WebSocket-powered live streaming chat with agents
- 🌐 **Public Sharing** — Share agents via public links with optional password protection

## Quick Start

### Prerequisites

[Bun](https://bun.sh/) runtime ≥ 1.2 is required.

```bash
curl -fsSL https://bun.sh/install | bash
```

### Install

```bash
bun add -g raw-agents
```

### Run

```bash
# Start the server (runs as background daemon)
raw-agents start

# Open the web UI
open http://localhost:15123
```

That's it! The web UI is bundled and served automatically.

## CLI Reference

```
raw-agents <command> [options]
```

### Commands

| Command   | Description                          |
| --------- | ------------------------------------ |
| `start`   | Start the agent server (daemon mode) |
| `stop`    | Stop the running server              |
| `restart` | Restart the server                   |
| `status`  | Check if the server is running       |
| `logs`    | View server logs                     |
| `version` | Print version                        |
| `help`    | Show help                            |

### Options

**start / restart:**

| Flag                | Default             | Description       |
| ------------------- | ------------------- | ----------------- |
| `--port <number>`   | `15123`             | Server port       |
| `--host <string>`   | `127.0.0.1`         | Server host       |
| `--data-dir <path>` | `~/.raw-agents` | Data directory    |
| `-f, --foreground`  | —                   | Run in foreground |

**logs:**

| Flag               | Default | Description                    |
| ------------------ | ------- | ------------------------------ |
| `--lines <number>` | `50`    | Number of lines to show        |
| `--follow`         | —       | Tail the log file continuously |

### Examples

```bash
# Start with custom port
raw-agents start --port 8080

# Expose to network
raw-agents start --host 0.0.0.0

# Run in foreground (useful for debugging)
raw-agents start --foreground

# View live logs
raw-agents logs --follow

# Check status
raw-agents status

# Stop the server
raw-agents stop
```

## Data Storage

All data is stored in the data directory (`~/.raw-agents` by default):

```
~/.raw-agents/
├── data.db        # SQLite database (agents, conversations, settings)
├── agent.pid      # PID file (daemon mode)
└── agent.log      # Server logs (daemon mode)
```

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Server**: [Hono](https://hono.dev/) — lightweight, fast HTTP framework
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Database**: SQLite (`bun:sqlite`) + Drizzle ORM
- **AI**: LangChain (`@langchain/*`)
- **State**: Redux Toolkit

## Development

```bash
# Clone the repo
git clone https://github.com/phamvanquyit/raw-agents.git
cd raw-agents

# Install dependencies
bun install

# Start dev servers (API + Vite HMR)
bun run dev

# Lint & format
bun run biome:check
```

## License

[MIT](LICENSE)
