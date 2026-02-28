# Bot Code Review — 2026-02-28

Thorough review of `packages/bot/lib/` covering async/await correctness, fire-and-forget patterns, error propagation, and the message/agent loop.

All issues have been fixed.

---

## Issues (all resolved)

### 1. [High] `setImmediate` callback crash — `opencode.ts:121` ✓

`processEvent` is dispatched via `setImmediate(() => cb(event))`. If `processEvent` throws (e.g., malformed event from SDK — `const { part } = event.properties` where `properties.part` is undefined), it's an **uncaught exception** inside a `setImmediate` callback. No `process.on("uncaughtException")` handler exists, so the process crashes.

Unlike a rejected promise, there's no `.catch()` to save it.

**Fixed:** Wrapped the `setImmediate` callback in try/catch:

```typescript
setImmediate(() => {
  try {
    cb(event);
  } catch (err) {
    console.error("[opencode] Event processing error:", err);
  }
});
```

### 2. [Low] Fire-and-forget `permission.reply` / `question.reply` — `handlers.ts` ✓

All three OpenCode reply calls were fire-and-forget with only `console.error` logging — invisible to the Telegram user. If a call failed, the user saw success feedback (callback answered, message deleted) but OpenCode never received the reply, causing the AI to hang.

**Mitigating factor:** All calls are to `localhost:4096`, so network failure is extremely unlikely.

**Fixed:** Added user-facing error messages in `.catch()` handlers:

- `permission.reply` — sends "Failed to send permission reply." on error
- `question.reply` (cancel) — sends "Failed to cancel question." on error
- `question.reply` (submit) — restructured to `.then()/.catch()` chain: "Answers submitted." only on success, "Failed to submit answers." on failure

### 3. [Low] Silent `.catch(() => {})` swallowing errors — `commands.ts`, `handlers.ts` ✓

Two locations swallowed errors with zero logging:

| Location | Call | Impact |
|----------|------|--------|
| `commands.ts` | `session.abort().catch(() => {})` | User told "Stopped" but abort may not have reached OpenCode. No log. |
| `handlers.ts` | `sendMessage("Answers submitted.").catch(() => {})` | User never sees confirmation. No log. |

**Fixed:**
- `session.abort` — changed `.catch(() => {})` to `.catch(console.error)`
- `submitAllAnswers` — restructured so "Answers submitted." is in `.then()` with `.catch(console.error)`

### 4. [Trivial] `/start` and `/stop` don't clear `pendingPermissions` — `commands.ts` ✓

When `/start` creates a new session, it cleared `accumulatedText` and `questionState` but not `pendingPermissions`. Old permission entries from previous sessions would accumulate in the map forever. Same issue with `/stop`.

**Fixed:** Added `state.clearPendingPermissions()` to both `/start` and `/stop` handlers.

### 5. [Trivial] Dead code: `clearAll()` — `state.ts` ✓

`clearAll()` was exported but never called anywhere in the codebase. Leftover from before the refactor.

**Fixed:** Removed.

### 6. [Trivial] Dead state: `QuestionState.messageIds` — `state.ts`, `events.ts` ✓

`showQuestion` pushed to `qs.messageIds` on every question message sent, but `messageIds` was never read anywhere. It was likely intended for cleanup (deleting all question messages when the flow completes) but that was never implemented.

**Fixed:** Removed `messageIds` from `QuestionState` interface and the push in `showQuestion`.

---

## Verified correct

Everything else checks out:

- **Async/await:** All `await` usage is correct. Fire-and-forget is only used where appropriate (prompt, typing actions, notification messages).
- **Promise chains:** The sequential chunk-sending chain in `message.updated` is correctly built (`chain = chain.then(...)`) with a terminal `.catch(console.error)`. No unhandled rejections.
- **SSE reconnection loop:** Properly structured with exponential backoff (1s base, 15s cap), abort signal checking, `setImmediate` yields between events, and cleanup in `finally`.
- **grammY update processing:** `bot.start()` processes updates **sequentially** (confirmed from grammY source: `await this.handleUpdate(update)` in a for loop). No concurrent handler races.
- **Typing indicator:** `stopTyping()` in `message.updated` runs before the fire-and-forget message chain completes, but Telegram's typing indicator has a ~5 second server-side TTL, so the indicator persists long enough to cover the send latency. Not a real UX issue.
- **Shutdown order:** `stopTyping()` → `stopEventListening()` → `server.close()` → `bot.stop()` is correct. Straggler `setImmediate` events after `stopEventListening()` still run but only attempt harmless Telegram API calls.
- **Auth middleware:** `ctx.from?.id !== userId` correctly blocks all update types for non-whitelisted users, including when `ctx.from` is undefined.
- **Session auto-creation:** No race condition because grammY is sequential. Two messages cannot have handlers running concurrently.
- **`waitWithAbort`:** Correctly handles both timer-first and abort-first cases with idempotent listener removal.
- **`chunkMessage`:** Uses `string.length` (UTF-16 code units), which matches Telegram's character limit for BMP text.
- **`autoRetry`:** Default config only retries 429 (flood wait). Doesn't interfere with fire-and-forget patterns.
- **`ensureSubscription` on every message:** After the first call, `subscribeToEvents` returns immediately (already listening to same directory). Just updates the callback reference (which is always the same function). Effectively a no-op.

---

## Fire-and-forget inventory

All intentional fire-and-forget patterns in the codebase:

| # | File | Call | Why F&F | Error handling |
|---|------|------|---------|----------------|
| 1 | `index.ts` | `client.session.prompt()` | Long-running (blocks until AI completes); awaiting would starve grammY polling | `.catch()` → logs + sends error to user |
| 2 | `opencode.ts` | `subscribeToEvents()` loop | Infinite SSE loop; runs for lifetime of process | Internal try/catch + reconnect logic |
| 3 | `events.ts` | `bot.api.sendMessage()` in `message.updated` | Sequential chunk chain; awaiting would block event processing | Terminal `.catch(console.error)` |
| 4 | `events.ts` | `bot.api.sendMessage()` in `session.error` | Notification; no dependent logic | `.catch(console.error)` |
| 5 | `events.ts` | `api.sendMessage()` in `showQuestion` | Notification with side effect (stores `msg.message_id`); no dependent logic | `.catch(console.error)` |
| 6 | `events.ts` | `bot.api.sendMessage()` in `permission.asked` | Sends permission prompt with inline keyboard; side effect stores `msg.message_id` | `.catch(console.error)` |
| 7 | `handlers.ts` | `getClient().permission.reply()` | Telegram callback already answered + message deleted; no need to block | `.catch()` → logs + sends error to user |
| 8 | `handlers.ts` | `getClient().question.reply()` (cancel) | Same as above | `.catch()` → logs + sends error to user |
| 9 | `handlers.ts` | `getClient().question.reply()` (submit) | Same as above | `.then()/.catch()` → success/error message to user |
| 10 | `index.ts` | `bot.api.sendMessage("still processing")` | Notification; no dependent logic | `.catch(() => {})` — acceptable, SessionLocked is an expected condition |
| 11 | `events.ts` | `bot.api.sendChatAction("typing")` | Typing indicator; failure is cosmetic | `.catch(() => {})` — acceptable, high frequency |
| 12 | `handlers.ts` | `ctx.deleteMessage()` | UI cleanup; failure is cosmetic | `.catch(() => {})` — acceptable |
| 13 | `handlers.ts` | `ctx.editMessageText("Question cancelled.")` | UI update; failure is cosmetic | `.catch(() => {})` — acceptable |
| 14 | `handlers.ts` | `ctx.editMessageText()` in `updateQuestionMessage` | Updates question keyboard on multi-select toggle; failure is cosmetic | `.catch(() => {})` — acceptable |
