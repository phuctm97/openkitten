# OpenKitten: Product Spec & Technical Architecture

## Context

OpenClaw (210k+ GitHub stars) is the dominant open-source AI agent, but has become buggy, insecure, and overly complex (~400k+ lines). NanoClaw emerged as a minimalist alternative (~3,900 lines, WhatsApp-first, Claude-only) but is limited to a single AI provider and Node.js.

OpenKitten fills the gap: a NanoClaw-simple AI agent that's **Bun-first**, **Telegram-first**, **OpenCode-first** (75+ AI providers), and **container-first** (Docker isolation). The goal is to ship something simple and working, gain users and feedback, then iterate.

---

## 1. Product Spec

### What It Does

Users message an AI agent on Telegram. The agent can browse the web, read/write files, run shell commands, and answer questions -- all inside a sandboxed environment. It supports any AI model (Claude, GPT, DeepSeek, Gemini, local models, etc.) through OpenCode.

### MVP User Stories

| # | Story |
|---|-------|
| US-1 | **Setup**: Clone repo, set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID`, and an AI provider key, run `bun run start`. Bot connects and replies to `/start`. |
| US-2 | **Chat**: Send a text message. Bot shows typing indicator, accumulates the response, sends the final result (auto-chunked if >4096 chars). |
| US-3 | **Tool permissions**: When the AI wants to run a shell command or edit a file, bot shows inline buttons: "Allow Once / Always Allow / Deny". |
| US-4 | **Interactive questions**: When the AI needs input (e.g., which approach to take), bot presents inline keyboard with options + custom text input. |
| US-5 | **Sessions**: `/new` creates a fresh session. `/sessions` lists and switches between them. `/stop` aborts a running prompt. |
| US-6 | **Single-user auth**: Only the configured Telegram user ID can interact with the bot. |

### MVP vs Future

| Feature | MVP | Future |
|---------|:---:|:------:|
| Single-user Telegram bot | Yes | -- |
| Text prompts + tool use | Yes | -- |
| Permission approval (inline buttons) | Yes | -- |
| Interactive questions | Yes | -- |
| Session management | Yes | -- |
| Typing indicator | Yes | -- |
| Auto-chunking (4096 char limit) | Yes | -- |
| Multi-user + allowlist | -- | Phase 3 |
| Docker container per user | -- | Phase 2 |
| Streaming responses (`@grammyjs/stream`) | -- | Phase 3 |
| Markdown formatting | -- | Phase 3 |
| File upload/download via Telegram | -- | Phase 2 |
| Scheduled tasks | -- | Phase 3 |
| Model switching via `/model` | -- | Phase 3 |
| Webhook mode | -- | Phase 3 |
| SQLite persistence | -- | Phase 2 |

---

## 2. Technical Architecture

### System Diagram

```
User
  |
  | Telegram Bot API (long polling)
  v
grammY Bot (@openkitten/bot)
  |
  | In-process function calls
  v
State Module (in-memory)
  |
  | HTTP REST + SSE (localhost:4096)
  v
OpenCode Server (spawned via createOpencodeServer)
  |
  ├── AI Provider APIs (Anthropic, OpenAI, Google, etc.)
  └── Built-in Tools
      ├── bash (shell commands)
      ├── edit (file modifications)
      ├── read / grep / glob (file access)
      ├── webfetch (fetch URLs)
      └── websearch (web search)
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Bun | Fast, built-in TypeScript, built-in SQLite (future) |
| Telegram | grammY v1.39+ | TypeScript-first, Bun-compatible, streaming plugin |
| AI Engine | OpenCode SDK v1.1+ | 75+ providers, tool use, SSE streaming, session mgmt |
| Monorepo | Bun workspaces | Already scaffolded |
| Linting | Biome | Already configured |
| Git hooks | Lefthook | Already configured |

### Monorepo Structure

```
openkitten/
  packages/
    bot/                          @openkitten/bot (MVP - only package needed)
      lib/
        index.ts                  Entry point: server startup, bot setup, message handling
        commands.ts               /start, /new, /stop, /sessions, /help
        handlers.ts               Callback query handlers (permissions, questions, sessions)
        events.ts                 SSE event processing, typing indicators, chunking
        opencode.ts               OpenCode SDK client wrapper, SSE with reconnect
        state.ts                  In-memory application state
      package.json
      tsconfig.json
```

Single package for MVP. Future splits when complexity warrants it:
- `packages/core/` - Session manager, container manager (Phase 2)
- `packages/container/` - Docker lifecycle management (Phase 2)
- `packages/db/` - SQLite persistence (Phase 2)

---

## 3. Component Deep-Dive

### 3.1 Entry Point (`lib/index.ts`)

**Responsibilities:**
1. Validate env vars (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID`)
2. Start OpenCode server via `createOpencodeServer({ port: 4096 })`
3. Initialize OpenCode SDK client
4. Create grammY bot with auth middleware (single-user whitelist)
5. Wire up command handlers, callback query handlers, text message handler
6. Handle graceful shutdown (SIGINT/SIGTERM)

**Message handling flow:**
```
Text message received
  → Check if waiting for custom question input → delegate to handlers
  → Check directory is set (else prompt /start)
  → Auto-create session if none exists
  → Ensure SSE subscription is active
  → Check busy flag (reject if busy, suggest /stop)
  → Set busy = true
  → Fire-and-forget client.session.prompt() (non-blocking so grammY keeps polling)
  → SSE events drive response delivery
```

**Key design decision:** `session.prompt()` is fire-and-forget (not awaited). The prompt call blocks until completion, but grammY's long polling must not be starved. Response delivery happens through SSE events instead.

### 3.2 OpenCode Client (`lib/opencode.ts`)

**Responsibilities:**
1. Initialize `createOpencodeClient({ baseUrl })` pointing to local server
2. Manage SSE event subscription with automatic reconnect
3. Exponential backoff (1s base, 15s max) on stream errors
4. Yield to event loop (`setImmediate`) between SSE events so grammY polling isn't starved
5. Abort controller for clean shutdown

### 3.3 Event Processing (`lib/events.ts`)

**Handles these OpenCode SSE event types:**

| Event | Behavior |
|-------|----------|
| `message.part.updated` | Accumulates text fragments, deduplicates via hash. Handles "pending" parts that arrive before message role is known. |
| `message.updated` | Detects completion (via `time.completed`), sends accumulated text to Telegram (chunked if >4096), clears state. |
| `session.error` | Sends error message to user, clears busy state. |
| `session.idle` | Clears busy state and accumulated text. |
| `permission.asked` | Shows inline keyboard (Allow Once / Always Allow / Deny). |
| `question.asked` | Initiates multi-step question flow with inline keyboard. |

**Text accumulation pattern:**
- `message.part.updated` events arrive with text fragments
- Parts are deduplicated using a djb2 hash (prevents duplicate SSE events on reconnect)
- Parts that arrive before their message's role is established are stored with `pending:${messageID}` key
- When `message.updated` fires with `time.completed`, all accumulated parts are joined and sent
- Long messages are split at 4096-char boundaries via `chunkMessage()`

**Typing indicator:** `sendChatAction("typing")` every 4 seconds while processing.

### 3.4 Commands (`lib/commands.ts`)

| Command | Behavior |
|---------|----------|
| `/start` | Lists projects from `client.project.list()`, selects first one, sets working directory, starts SSE subscription |
| `/new` | Creates fresh OpenCode session, clears accumulated state, resets busy flag |
| `/stop` | Calls `client.session.abort()`, clears all state |
| `/sessions` | Lists sessions as inline keyboard buttons for switching |
| `/help` | Shows available commands and bot description |

### 3.5 Callback Handlers (`lib/handlers.ts`)

**Three callback categories:**

1. **`permission:*`** - Permission approval/denial
2. **`question:*`** - Interactive multi-step questions (single/multi-select + custom text)
3. **`sess:*`** - Session switching

### 3.6 State Management (`lib/state.ts`)

**All state is module-level mutable variables (appropriate for single-user MVP):**

| State | Type | Purpose |
|-------|------|---------|
| `activeSession` | `SessionInfo \| null` | Current OpenCode session (id, title, directory) |
| `activeDirectory` | `string \| null` | Working directory |
| `accumulatedText` | `Map<string, string[]>` | Text parts being collected per message |
| `partHashes` | `Map<string, Set<string>>` | Deduplication hashes for SSE events |
| `messageRoles` | `Map<string, {role}>` | Message role tracking (assistant vs user) |
| `pendingPermissions` | `Map<number, PendingPermission>` | Telegram msg ID → permission request |
| `questionState` | `QuestionState \| null` | Current interactive question flow |
| `busy` | `boolean` | Whether a prompt is in-flight |

---

## 4. Data Flow: End-to-End

### User sends "Summarize the README"

```
1. Telegram delivers message via long polling
2. grammY middleware checks ctx.from.id === TELEGRAM_USER_ID ✓
3. bot.on("message:text") handler fires
4. Check: not waiting for custom input, directory is set, session exists
5. ensureSubscription() ensures SSE stream is active
6. state.setBusy(true)
7. client.session.prompt({ sessionID, parts: [{ type: "text", text }] })
   → Fire-and-forget (not awaited)
8. OpenCode server receives prompt via REST API
9. OpenCode sends prompt to AI provider (e.g., Claude)
10. AI responds with tool calls (e.g., read the README file)
    → OpenCode executes tools and continues the conversation loop
11. SSE events stream back:
    a. message.part.updated (text fragments) → accumulated in state
    b. message.updated (with time.completed) → triggers send
12. Bot sends accumulated text to Telegram (chunked if needed)
13. state.setBusy(false)
```

### AI wants to run `cat README.md`

```
1. SSE: permission.asked { permission: "bash", patterns: ["cat README.md"] }
2. events.ts stops typing indicator
3. Bot sends inline keyboard: "Allow Once | Always Allow | Deny"
4. User taps "Allow Once"
5. handlers.ts: client.permission.reply({ requestID, reply: "once" })
6. OpenCode executes the command
7. AI continues processing with the result
```

---

## 5. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OpenCode server per user (future) vs shared | Per user | SessionLockedError + filesystem isolation |
| Streaming responses (MVP) | Accumulate-then-send | Simpler, avoids Telegram edit rate limits (~5/min/msg) |
| Persistence (MVP) | In-memory | Single user, OpenCode stores session history itself |
| Long polling vs webhooks (MVP) | Long polling | Simpler for self-hosted, no public endpoint needed |
| Fire-and-forget prompts | Yes | Prevents starving grammY's polling loop |
| SSE event deduplication | djb2 hash | Prevents duplicate delivery on reconnect |

---

## 6. Configuration

### MVP: Environment Variables Only

```bash
# Required
TELEGRAM_BOT_TOKEN=...        # From @BotFather
TELEGRAM_USER_ID=...          # Your Telegram numeric user ID

# At least one AI provider key (OpenCode handles provider config)
ANTHROPIC_API_KEY=...
# or OPENAI_API_KEY=...
# or any of 75+ providers
```

OpenCode's own `opencode.json` in the project directory handles model selection, tool permissions, and provider configuration. The bot does not duplicate this.

---

## 7. Phased Roadmap

### Phase 1: MVP (Current)

- Single-user Telegram bot with all core features
- `@grammyjs/auto-retry` for Telegram flood wait handling
- `/help` command and `setMyCommands()` for command menu
- SessionLockedError retry logic
- Busy timeout safety valve (5 min auto-reset)
- Dockerfile and docker-compose.yml

### Phase 2: Container Isolation + Persistence

- Docker container lifecycle management
- One OpenCode server per user in isolated container
- `bun:sqlite` for user-container mapping and session persistence
- File upload/download through Telegram
- Persisted "always allow" permission rules

### Phase 3: Multi-User + Polish

- Multi-user support with allowlist
- Per-user state isolation
- `@grammyjs/stream` for animated streaming responses
- Telegram MarkdownV2 formatting for code blocks
- `/model`, `/provider`, `/config` commands
- Webhook mode for production
- Scheduled tasks
