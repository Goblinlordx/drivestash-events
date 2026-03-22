import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SyncEngine, SyncStatusListener } from 'drivestash'
import type { EventRecord } from './types'
import { createEventLog } from './event-log'

type MockEngine = SyncEngine<EventRecord> & {
  _records: Map<string, EventRecord>
  _injectRemote: (events: EventRecord[]) => void
}

function createMockEngine(): MockEngine {
  const records = new Map<string, EventRecord>()
  const staged: EventRecord[] = []

  function applyStaged() {
    for (const e of staged) records.set(e.id, e)
    staged.length = 0
  }

  return {
    _records: records,
    _injectRemote(events: EventRecord[]) {
      // Stage events — they appear in records only when pull/sync runs
      staged.push(...events)
    },
    get: vi.fn(async (id: string) => records.get(id)),
    put: vi.fn(async (record: EventRecord) => { records.set(record.id, record) }),
    delete: vi.fn(async (id: string) => { records.delete(id) }),
    list: vi.fn(async () => Array.from(records.values())),
    sync: vi.fn(async () => { applyStaged() }),
    pull: vi.fn(async () => { applyStaged() }),
    push: vi.fn(async () => {}),
    onStatusChange: vi.fn((_l: SyncStatusListener) => () => {}),
    destroy: vi.fn(),
  }
}

function makeRemoteEvent(id: string, type: string, payload: unknown = {}): EventRecord {
  return {
    id,
    updatedAt: '2026-01-01T00:00:00.000Z',
    type,
    payload,
    metadata: { deviceId: 'remote-device', timestamp: '2026-01-01T00:00:00.000Z', sequence: 1 },
  }
}

describe('EventLog.subscribe', () => {
  let engine: MockEngine
  let log: ReturnType<typeof createEventLog>

  beforeEach(() => {
    engine = createMockEngine()
    log = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
    }, { engine })
  })

  it('fires on local append', async () => {
    const listener = vi.fn()
    log.subscribe(listener)

    await log.append('test', { value: 1 })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0].type).toBe('test')
    expect(listener.mock.calls[0][0].payload).toEqual({ value: 1 })
  })

  it('fires for each append', async () => {
    const listener = vi.fn()
    log.subscribe(listener)

    await log.append('a', {})
    await log.append('b', {})
    await log.append('c', {})

    expect(listener).toHaveBeenCalledTimes(3)
    expect(listener.mock.calls.map((c: [EventRecord]) => c[0].type)).toEqual(['a', 'b', 'c'])
  })

  it('unsubscribe stops notifications', async () => {
    const listener = vi.fn()
    const unsub = log.subscribe(listener)

    await log.append('before', {})
    unsub()
    await log.append('after', {})

    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0].type).toBe('before')
  })

  it('supports multiple listeners', async () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    log.subscribe(listener1)
    log.subscribe(listener2)

    await log.append('test', {})

    expect(listener1).toHaveBeenCalledOnce()
    expect(listener2).toHaveBeenCalledOnce()
  })

  it('destroy clears all subscribers', async () => {
    const listener = vi.fn()
    log.subscribe(listener)
    log.destroy()

    // Create a new log to test — destroy cleared the old one's listeners
    const engine2 = createMockEngine()
    const log2 = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
    }, { engine: engine2 })

    const listener2 = vi.fn()
    log2.subscribe(listener2)
    await log2.append('test', {})
    expect(listener2).toHaveBeenCalledOnce()
    // Original listener should not have been called after destroy
    expect(listener).toHaveBeenCalledTimes(0)
  })
})

describe('EventLog.subscribe — sync-triggered notifications', () => {
  let engine: MockEngine
  let log: ReturnType<typeof createEventLog>

  beforeEach(() => {
    engine = createMockEngine()
    log = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
    }, { engine })
  })

  it('notifies for new events arriving via pull', async () => {
    // Append a local event first (to establish known IDs)
    await log.append('local', {})

    const listener = vi.fn()
    log.subscribe(listener)
    listener.mockClear() // Clear the notification from append above... wait, subscribe was after append

    // Inject remote events into the engine (simulating pull)
    engine._injectRemote([
      makeRemoteEvent('01REMOTE0000AAAAAAAAAAAAA', 'remote.event', { from: 'other device' }),
    ])

    await log.pull()

    // Listener should have been called for the new remote event
    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0].type).toBe('remote.event')
  })

  it('does not re-notify for already-known events after sync', async () => {
    const listener = vi.fn()
    log.subscribe(listener)

    await log.append('local', {})
    expect(listener).toHaveBeenCalledOnce()
    listener.mockClear()

    // Sync with no new events
    await log.sync()

    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies for multiple new events from sync in order', async () => {
    const listener = vi.fn()
    log.subscribe(listener)

    // Inject two remote events
    engine._injectRemote([
      makeRemoteEvent('01REMOTE0000BBBBBBBBBBBB2', 'second', {}),
      makeRemoteEvent('01REMOTE0000AAAAAAAAAAAAA', 'first', {}),
    ])

    await log.sync()

    expect(listener).toHaveBeenCalledTimes(2)
    // Should arrive sorted by ULID (first before second)
    expect(listener.mock.calls[0][0].type).toBe('first')
    expect(listener.mock.calls[1][0].type).toBe('second')
  })
})
