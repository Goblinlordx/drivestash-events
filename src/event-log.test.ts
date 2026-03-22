import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SyncEngine, SyncStatusListener } from 'drivestash'
import type { EventRecord } from './types'
import { createEventLog } from './event-log'

type MockEngine = SyncEngine<EventRecord> & { _records: Map<string, EventRecord> }

/** In-memory mock of drivestash SyncEngine typed for EventRecord. */
function createMockEngine(): MockEngine {
  const records = new Map<string, EventRecord>()
  const listeners = new Set<SyncStatusListener>()
  return {
    _records: records,
    get: vi.fn(async (id: string) => records.get(id)),
    put: vi.fn(async (record: EventRecord) => { records.set(record.id, record) }),
    delete: vi.fn(async (id: string) => { records.delete(id) }),
    list: vi.fn(async () => Array.from(records.values())),
    sync: vi.fn(async () => {}),
    pull: vi.fn(async () => {}),
    push: vi.fn(async () => {}),
    onStatusChange: vi.fn((listener: SyncStatusListener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }),
    clear: vi.fn(async () => { records.clear() }),
    clearRemote: vi.fn(async () => { records.clear() }),
    destroy: vi.fn(),
  }
}

describe('EventLog.append', () => {
  let engine: MockEngine
  let log: ReturnType<typeof createEventLog>

  beforeEach(() => {
    engine = createMockEngine()
    log = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
      engine,
    })
  })

  it('creates an EventRecord with correct structure', async () => {
    const event = await log.append('todo.created', { title: 'Buy milk' })

    expect(event.id).toHaveLength(26) // ULID
    expect(event.type).toBe('todo.created')
    expect(event.payload).toEqual({ title: 'Buy milk' })
    expect(event.metadata.deviceId).toBe('device-1')
    expect(event.metadata.sequence).toBe(1)
    expect(typeof event.metadata.timestamp).toBe('string')
    expect(event.updatedAt).toBe(event.metadata.timestamp)
  })

  it('assigns monotonically increasing sequence numbers', async () => {
    const e1 = await log.append('a', {})
    const e2 = await log.append('b', {})
    const e3 = await log.append('c', {})
    expect(e1.metadata.sequence).toBe(1)
    expect(e2.metadata.sequence).toBe(2)
    expect(e3.metadata.sequence).toBe(3)
  })

  it('persists the event via engine.put()', async () => {
    await log.append('test', { value: 42 })
    expect(engine.put).toHaveBeenCalledOnce()
    const stored = vi.mocked(engine.put).mock.calls[0][0]
    expect(stored.type).toBe('test')
    expect(stored.payload).toEqual({ value: 42 })
  })

  it('event ID is a valid ULID', async () => {
    const event = await log.append('test', {})
    expect(event.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  })
})

describe('EventLog.list', () => {
  it('returns events sorted by ID (ULID = time-sorted)', async () => {
    const engine = createMockEngine()
    const log = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
      engine,
    })

    // Insert events with known IDs in non-sorted order
    const records: EventRecord[] = [
      {
        id: '01HZZ00000CCCCCCCCCCCCCCCC', updatedAt: '2026-01-03T00:00:00.000Z',
        type: 'c', payload: {}, metadata: { deviceId: 'd1', timestamp: '2026-01-03T00:00:00.000Z', sequence: 3 },
      },
      {
        id: '01HZZ00000BBBBBBBBBBBBBBBB', updatedAt: '2026-01-01T00:00:00.000Z',
        type: 'a', payload: {}, metadata: { deviceId: 'd1', timestamp: '2026-01-01T00:00:00.000Z', sequence: 1 },
      },
      {
        id: '01HZY00000AAAAAAAAAAAAAAAA', updatedAt: '2026-01-02T00:00:00.000Z',
        type: 'b', payload: {}, metadata: { deviceId: 'd1', timestamp: '2026-01-02T00:00:00.000Z', sequence: 2 },
      },
    ]
    for (const r of records) engine._records.set(r.id, r)

    const events = await log.list()
    const ids = events.map((e) => e.id)
    expect(ids).toEqual([...ids].sort())
  })
})

describe('EventLog immutability', () => {
  it('does not expose update or delete methods', () => {
    const engine = createMockEngine()
    const log = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
      engine,
    })

    expect('delete' in log).toBe(false)
    expect('update' in log).toBe(false)
    expect('put' in log).toBe(false)
    expect('remove' in log).toBe(false)
  })
})

describe('EventLog sync delegation', () => {
  let engine: MockEngine
  let log: ReturnType<typeof createEventLog>

  beforeEach(() => {
    engine = createMockEngine()
    log = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
      engine,
    })
  })

  it('sync() delegates to engine', async () => {
    await log.sync()
    expect(engine.sync).toHaveBeenCalledOnce()
  })

  it('pull() delegates to engine', async () => {
    await log.pull()
    expect(engine.pull).toHaveBeenCalledOnce()
  })

  it('push() delegates to engine', async () => {
    await log.push()
    expect(engine.push).toHaveBeenCalledOnce()
  })

  it('onStatusChange() delegates to engine', () => {
    const listener = vi.fn()
    const unsub = log.onStatusChange(listener)
    expect(engine.onStatusChange).toHaveBeenCalledOnce()
    expect(typeof unsub).toBe('function')
  })

  it('destroy() delegates to engine', () => {
    log.destroy()
    expect(engine.destroy).toHaveBeenCalledOnce()
  })
})

describe('EventLog.clear', () => {
  let engine: MockEngine
  let log: ReturnType<typeof createEventLog>

  beforeEach(() => {
    engine = createMockEngine()
    log = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
      engine,
    })
  })

  it('delegates to engine.clear()', async () => {
    await log.clear()
    expect(engine.clear).toHaveBeenCalledOnce()
  })

  it('wipes all events from local store', async () => {
    await log.append('a', { v: 1 })
    await log.append('b', { v: 2 })
    expect((await log.list()).length).toBe(2)

    await log.clear()
    expect((await log.list()).length).toBe(0)
  })

  it('resets sequence counter after clear', async () => {
    await log.append('a', {})
    await log.append('b', {})
    await log.clear()

    const event = await log.append('c', {})
    expect(event.metadata.sequence).toBe(1)
  })

  it('list returns empty after clear', async () => {
    await log.append('a', {})
    await log.clear()
    const events = await log.list()
    expect(events).toEqual([])
  })
})

describe('EventLog.clearRemote', () => {
  let engine: MockEngine
  let log: ReturnType<typeof createEventLog>

  beforeEach(() => {
    engine = createMockEngine()
    log = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
      engine,
    })
  })

  it('delegates to engine.clearRemote()', async () => {
    await log.clearRemote()
    expect(engine.clearRemote).toHaveBeenCalledOnce()
  })

  it('wipes all events from local store', async () => {
    await log.append('a', { v: 1 })
    await log.append('b', { v: 2 })
    expect((await log.list()).length).toBe(2)

    await log.clearRemote()
    expect((await log.list()).length).toBe(0)
  })

  it('resets sequence counter after clearRemote', async () => {
    await log.append('a', {})
    await log.append('b', {})
    await log.clearRemote()

    const event = await log.append('c', {})
    expect(event.metadata.sequence).toBe(1)
  })
})
