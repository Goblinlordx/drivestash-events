# drivestash-events

Append-only event log with offline-first sync via [drivestash](https://github.com/Goblinlordx/drivestash).

Store immutable events locally in IndexedDB, sync them to Google Drive, and derive application state by replaying events through projection functions. Built for multi-device usage — events from different devices merge safely without data loss.

## Features

- **Append-only event log** — immutable events that can never be modified or deleted
- **ULID identifiers** — time-sortable, globally unique event IDs
- **Multi-device sync** — union merge ensures no events are lost across devices
- **Projections** — fold events into derived state with pure functions
- **Queries** — filter events by type, time range, or custom predicate
- **Subscriptions** — react to new events from local appends or remote sync
- **Offline-first** — all writes go to IndexedDB immediately, sync when online
- **Zero extra dependencies** — only [drivestash](https://www.npmjs.com/package/drivestash) (bundled automatically)
- **Type-safe** — full TypeScript with generics for event payloads

## Installation

```bash
npm install drivestash-events
```

That's it — `drivestash` is included as a dependency and installed automatically.

## Quick Start

```typescript
import { createEventLog } from 'drivestash-events'

// Create an event log backed by Google Drive
const log = createEventLog({
  storeName: 'my-app-events',
  getAccessToken: () => getGoogleOAuthToken(), // your auth function
})

// Append events
await log.append('todo.created', { title: 'Buy milk', done: false })
await log.append('todo.completed', { id: 'abc', completedAt: new Date().toISOString() })

// List all events (sorted by creation time)
const events = await log.list()

// Sync with Google Drive
await log.sync()

// Clean up when done
log.destroy()
```

## API Reference

### `createEventLog<TPayload>(config)`

Creates an event log instance.

```typescript
import { createEventLog } from 'drivestash-events'

const log = createEventLog<MyPayload>({
  storeName: 'my-events',       // IndexedDB + Drive file name
  getAccessToken: () => token,  // Google OAuth2 token provider
  deviceId: 'optional-id',      // auto-generated if omitted
})
```

**Config:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storeName` | `string` | yes | Name for the underlying drivestash store |
| `getAccessToken` | `() => string \| null` | yes | Returns a Google OAuth2 token, or null |
| `deviceId` | `string` | no | Device identifier. Auto-generated via `getDeviceId()` if omitted |
| `engine` | `SyncEngine` | no | Custom SyncEngine instance. Bypasses default drivestash engine creation. Useful for testing or custom storage backends. |

### `EventLog<TPayload>`

The event log interface returned by `createEventLog()`.

#### `log.append(type, payload)`

Append an immutable event. Returns the created `EventRecord`.

```typescript
const event = await log.append('item.added', { name: 'Widget' })
// event.id       → '01HZZABC...' (ULID)
// event.type     → 'item.added'
// event.payload  → { name: 'Widget' }
// event.metadata → { deviceId, timestamp, sequence }
```

#### `log.list()`

List all events sorted by ULID (chronological order).

```typescript
const events = await log.list()
```

#### `log.project(projector)`

Replay all events through a projector to derive state.

```typescript
const count = await log.project({
  init: 0,
  apply: (state, event) => state + 1,
})
```

#### `log.query(query)`

Filter events by type, time range, or custom predicate. All filters are ANDed.

```typescript
const recent = await log.query({
  type: 'todo.created',
  after: '2026-01-01T00:00:00.000Z',
  filter: (e) => e.payload.priority === 'high',
})
```

#### `log.subscribe(listener)`

Subscribe to new events. Fires on local appends and events arriving via sync. Returns an unsubscribe function.

```typescript
const unsub = log.subscribe((event) => {
  console.log('New event:', event.type, event.payload)
})

// Later:
unsub()
```

#### `log.sync()` / `log.pull()` / `log.push()`

Sync operations delegated to the underlying drivestash engine.

- `sync()` — full bidirectional sync (pull + push)
- `pull()` — download and merge remote events
- `push()` — upload local events to Google Drive

#### `log.onStatusChange(listener)`

Subscribe to sync status changes (`'idle' | 'syncing' | 'synced' | 'offline' | 'error'`).

```typescript
const unsub = log.onStatusChange((status) => {
  console.log('Sync status:', status)
})
```

#### `log.clear()`

Clear all local events and reset internal state. Data remains on Google Drive and will be restored on next sync.

#### `log.clearRemote()`

Clear all local events AND delete the remote Google Drive file. **This is not recoverable** — the data is permanently gone.

| Method | Local | Remote | Recoverable |
|--------|-------|--------|-------------|
| `clear()` | Wipes IndexedDB | Untouched | Yes — data restored on next sync |
| `clearRemote()` | Wipes IndexedDB | Deletes Drive file | No — permanent deletion |

#### `log.destroy()`

Clean up event listeners and resources.

### `project(events, projector)`

Standalone projection function. Folds an event array through a projector.

```typescript
import { project } from 'drivestash-events'
import type { Projector } from 'drivestash-events'

const sum: Projector<number, { amount: number }> = {
  init: 0,
  apply: (state, event) => state + event.payload.amount,
}

const total = project(events, sum)
```

### `queryEvents(events, query)`

Standalone query function. Filters an event array.

```typescript
import { queryEvents } from 'drivestash-events'

const results = queryEvents(events, {
  type: 'payment',
  after: '2026-01-01T00:00:00.000Z',
})
```

### `createEventId()`

Generate a ULID (Universally Unique Lexicographically Sortable Identifier).

```typescript
import { createEventId } from 'drivestash-events'

const id = createEventId() // '01HZZABC...' (26 chars, Crockford Base32)
```

### `getDeviceId(storage?)`

Get or generate a persistent device identifier stored in localStorage.

```typescript
import { getDeviceId } from 'drivestash-events'

const deviceId = getDeviceId() // UUID, persisted across sessions
```

### `unionMerge(local, remote)`

Append-only merge strategy for drivestash. Combines two record arrays by ID without data loss.

```typescript
import { unionMerge } from 'drivestash-events'

const merged = unionMerge(localEvents, remoteEvents)
// All unique events from both arrays, no duplicates
```

### `EventRecord<TPayload>`

```typescript
interface EventRecord<TPayload = unknown> {
  readonly id: string           // ULID
  readonly updatedAt: string    // ISO 8601 (set once, never changes)
  readonly type: string         // event type discriminator
  readonly payload: TPayload    // event-specific data
  readonly metadata: EventMetadata
}

interface EventMetadata {
  readonly deviceId: string     // originating device
  readonly timestamp: string    // ISO 8601 creation time
  readonly sequence: number     // per-device monotonic counter
}
```

## Usage Patterns

### Projecting State from Events

Derive application state by replaying events through a projector — a pure function with an initial state and an apply step.

```typescript
// Track visited locations (like a stamp collection)
interface StampState {
  stamps: Set<string>
  count: number
}

const stampProjector: Projector<StampState, { itemId: string }> = {
  init: { stamps: new Set(), count: 0 },
  apply: (state, event) => {
    if (event.type === 'stamp.added') {
      const stamps = new Set(state.stamps)
      stamps.add(event.payload.itemId)
      return { stamps, count: stamps.size }
    }
    if (event.type === 'stamp.removed') {
      const stamps = new Set(state.stamps)
      stamps.delete(event.payload.itemId)
      return { stamps, count: stamps.size }
    }
    return state
  },
}

const state = await log.project(stampProjector)
console.log(`${state.count} locations visited`)
```

### Computing Derived Metrics

Multiple independent projections over the same event stream:

```typescript
// Progress by category
const progressProjector: Projector<Map<string, number>, { itemId: string; category: string }> = {
  init: new Map(),
  apply: (state, event) => {
    if (event.type === 'stamp.added') {
      const count = state.get(event.payload.category) ?? 0
      return new Map(state).set(event.payload.category, count + 1)
    }
    return state
  },
}

// Score / gamification
const scoreProjector: Projector<number, { itemId: string }> = {
  init: 0,
  apply: (state, event) => {
    if (event.type === 'stamp.added') return state + 100 // 100 XP per stamp
    return state
  },
}

const progress = await log.project(progressProjector)
const score = await log.project(scoreProjector)
```

### Subscribing to Changes

React to events in real time — both local appends and events arriving from other devices via sync:

```typescript
log.subscribe((event) => {
  if (event.type === 'stamp.added') {
    updateUI(event.payload.itemId)
  }
})

// Sync periodically or on visibility change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    log.sync()
  }
})
```

### Multi-Device Sync

Events from different devices merge safely. Each event has a globally unique ULID, so two devices appending simultaneously never conflict:

```typescript
// Device A
await log.append('note.created', { text: 'From phone' })

// Device B (same storeName, different device)
await log.append('note.created', { text: 'From laptop' })

// After sync on either device:
const events = await log.list()
// Both events are present, sorted by creation time
```

### Logout / Account Switching

Clear local data when a user logs out to prevent events leaking between accounts:

```typescript
async function handleLogout() {
  await log.clear()  // wipe local only — data stays on Drive
  log.destroy()      // clean up listeners
}

async function handleLogin(newToken: string) {
  token = newToken
  await log.sync()   // pulls the new account's events from Drive
}
```

### Full Data Deletion

If a user requests permanent deletion of all their data:

```typescript
async function handleDeleteAllData() {
  await log.clearRemote()  // wipes local AND deletes Drive file
  log.destroy()
}
```

## Testing

Inject a mock engine via `config.engine` to test without real storage:

```typescript
import { createEventLog } from 'drivestash-events'
import type { SyncEngine, EventRecord } from 'drivestash-events'

// Create a simple in-memory mock
function createMockEngine(): SyncEngine<EventRecord> {
  const records = new Map<string, EventRecord>()
  return {
    get: async (id) => records.get(id),
    put: async (record) => { records.set(record.id, record) },
    delete: async (id) => { records.delete(id) },
    list: async () => Array.from(records.values()),
    sync: async () => {},
    pull: async () => {},
    push: async () => {},
    clear: async () => { records.clear() },
    clearRemote: async () => { records.clear() },
    onStatusChange: () => () => {},
    destroy: () => {},
  }
}

const log = createEventLog({
  storeName: 'test',
  getAccessToken: () => null,
  engine: createMockEngine(),  // no IndexedDB or Drive needed
})

await log.append('test', { value: 42 })
const events = await log.list() // works entirely in memory
```

All drivestash types are re-exported from `drivestash-events` — no need to install drivestash as a separate dependency for type imports.

## How It Works

### Architecture

```
Your App
  └── drivestash-events (this library)
        ├── EventLog — append, list, project, query, subscribe
        ├── unionMerge — append-only conflict resolution
        └── drivestash (bundled dependency)
              ├── IndexedDB — local offline storage
              └── Google Drive appDataFolder — cloud sync
```

### ULID Ordering

Event IDs are [ULIDs](https://github.com/ulid/spec) — 26-character identifiers that encode a millisecond timestamp and random component. ULIDs sort lexicographically by creation time, so `list()` returns events in chronological order without needing a separate timestamp comparison.

### Union Merge

When syncing between devices, events are merged by ID. Since each event has a globally unique ULID and events are immutable (never modified after creation), the merge is a simple set union — every event from both sides is kept, duplicates are eliminated by ID.

This is safe because:
1. ULIDs are globally unique (timestamp + randomness)
2. Events are immutable (same ID = identical content)
3. Two devices cannot produce the same ULID

### Offline-First

All writes go to IndexedDB immediately via drivestash. The app works fully offline. When connectivity returns, call `sync()` to push local events to Google Drive and pull events from other devices.

## When to Use

- **Audit trails** — track every action with an immutable log
- **Undo/redo** — replay events to any point in time
- **Cross-device sync** — offline-first apps that sync via Google Drive
- **Event-driven state** — derive UI state from event projections
- **Collection tracking** — stamps, badges, progress systems
- **Activity feeds** — chronological streams of user actions

## When NOT to Use

- **High-frequency writes** — drivestash syncs entire JSON blobs to Google Drive; not suitable for thousands of events per minute
- **Large datasets** — Google Drive appDataFolder has practical limits (~5MB per file); event logs with tens of thousands of events may hit this ceiling
- **Real-time collaboration** — no push-based sync; devices must call `pull()` to receive updates
- **Server-side usage** — designed for browsers (IndexedDB, localStorage, Google OAuth)
- **Non-Google auth** — requires Google OAuth2 for cloud sync; local-only usage works without auth but won't sync
- **CQRS/DDD frameworks** — this is a lightweight event log, not a full event sourcing framework with aggregates, command handlers, or saga orchestration

## Limitations and Risks

| Limitation | Detail |
|------------|--------|
| **Google Drive only** | Cloud sync requires Google OAuth. No pluggable backends. |
| **Single JSON blob** | All events stored as one file on Drive. Performance degrades with very large logs. |
| **No tombstones** | drivestash doesn't support record deletion. Events are permanent (which is the point). |
| **No real-time push** | Devices must explicitly call `sync()` / `pull()`. No WebSocket or Server-Sent Events. |
| **Browser only** | Depends on IndexedDB, localStorage, and Web Crypto API. |
| **Eventually consistent** | Two devices may see different states until they sync. |
| **No snapshot optimization** | Projections always replay all events. For very large logs, this may become slow. |

## License

[MIT](LICENSE)
