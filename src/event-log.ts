import type { SyncEngine, SyncRecord, SyncStatusListener } from 'drivestash'
import type { EventRecord, EventLogConfig } from './types'
import { createEventId } from './event-id'
import { unionMerge } from './union-merge'
import { getDeviceId } from './device-id'

/** Public API for the event log. */
export interface EventLog<TPayload = unknown> {
  /** Append an immutable event to the log. */
  append(type: string, payload: TPayload): Promise<EventRecord<TPayload>>
  /** List all events, sorted by ID (ULID = chronological order). */
  list(): Promise<EventRecord<TPayload>[]>
  /** Trigger a full bidirectional sync with the remote store. */
  sync(): Promise<void>
  /** Pull remote changes and merge into local store. */
  pull(): Promise<void>
  /** Push local events to the remote store. */
  push(): Promise<void>
  /** Subscribe to sync status changes. Returns an unsubscribe function. */
  onStatusChange(listener: SyncStatusListener): () => void
  /** Clean up resources and event listeners. */
  destroy(): void
}

/** Internal options for dependency injection (testing). */
interface InternalOptions<TPayload> {
  engine?: SyncEngine<EventRecord<TPayload>>
}

/**
 * Create an append-only event log backed by drivestash.
 *
 * Events are immutable records with ULID IDs (sortable by creation time).
 * A custom union merge ensures no events are lost during multi-device sync.
 * The log exposes no update or delete operations — events are permanent.
 */
export function createEventLog<TPayload = unknown>(
  config: EventLogConfig,
  _internal?: InternalOptions<TPayload>,
): EventLog<TPayload> {
  const deviceId = config.deviceId ?? getDeviceId()
  let sequence = 0

  // Use injected engine (tests) or create a real one via dynamic import
  let engine: SyncEngine<EventRecord<TPayload>>
  let engineReady: Promise<void>

  if (_internal?.engine) {
    engine = _internal.engine
    engineReady = Promise.resolve()
  } else {
    // Lazy import drivestash to keep it as a peer dependency
    engineReady = import('drivestash').then((mod) => {
      engine = mod.createSyncEngine<EventRecord<TPayload>>({
        storeName: config.storeName,
        getAccessToken: config.getAccessToken,
        merge: unionMerge,
      })
    })
  }

  async function ensureEngine(): Promise<SyncEngine<EventRecord<TPayload>>> {
    await engineReady
    return engine
  }

  return {
    async append(type: string, payload: TPayload): Promise<EventRecord<TPayload>> {
      const eng = await ensureEngine()
      sequence += 1
      const timestamp = new Date().toISOString()
      const event: EventRecord<TPayload> = {
        id: createEventId(),
        updatedAt: timestamp,
        type,
        payload,
        metadata: {
          deviceId,
          timestamp,
          sequence,
        },
      }
      await eng.put(event)
      return event
    },

    async list(): Promise<EventRecord<TPayload>[]> {
      const eng = await ensureEngine()
      const events = await eng.list()
      return events.sort((a, b) => a.id.localeCompare(b.id))
    },

    async sync(): Promise<void> {
      const eng = await ensureEngine()
      return eng.sync()
    },

    async pull(): Promise<void> {
      const eng = await ensureEngine()
      return eng.pull()
    },

    async push(): Promise<void> {
      const eng = await ensureEngine()
      return eng.push()
    },

    onStatusChange(listener: SyncStatusListener): () => void {
      // Engine must be initialized synchronously for this to work with injected mocks
      if (_internal?.engine) {
        return engine.onStatusChange(listener)
      }
      // For real engines, queue the listener registration
      let unsub: (() => void) | undefined
      engineReady.then(() => {
        unsub = engine.onStatusChange(listener)
      })
      return () => unsub?.()
    },

    destroy(): void {
      if (_internal?.engine) {
        engine.destroy()
        return
      }
      engineReady.then(() => engine.destroy())
    },
  }
}
