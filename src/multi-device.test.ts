import { describe, it, expect, vi } from 'vitest'
import type { SyncEngine, SyncStatusListener } from 'drivestash'
import type { EventRecord } from './types'
import { createEventLog } from './event-log'
import { unionMerge } from './union-merge'

type MockEngine = SyncEngine<EventRecord> & { _records: Map<string, EventRecord> }

function createMockEngine(): MockEngine {
  const records = new Map<string, EventRecord>()
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
      return () => {}
    }),
    clear: vi.fn(async () => { records.clear() }),
    clearRemote: vi.fn(async () => { records.clear() }),
    destroy: vi.fn(),
  }
}

describe('Multi-device safety', () => {
  it('two devices appending to the same store produce distinct events', async () => {
    const engine1 = createMockEngine()
    const engine2 = createMockEngine()

    const log1 = createEventLog({
      storeName: 'shared',
      getAccessToken: () => null,
      deviceId: 'device-A',
      engine: engine1,
    })

    const log2 = createEventLog({
      storeName: 'shared',
      getAccessToken: () => null,
      deviceId: 'device-B',
      engine: engine2,
    })

    const e1 = await log1.append('item.added', { name: 'alpha' })
    const e2 = await log1.append('item.added', { name: 'beta' })
    const e3 = await log2.append('item.added', { name: 'gamma' })
    const e4 = await log2.append('item.added', { name: 'delta' })

    // Different IDs
    const allIds = [e1.id, e2.id, e3.id, e4.id]
    expect(new Set(allIds).size).toBe(4)

    // Different device IDs
    expect(e1.metadata.deviceId).toBe('device-A')
    expect(e3.metadata.deviceId).toBe('device-B')

    // Each device has its own sequence
    expect(e1.metadata.sequence).toBe(1)
    expect(e2.metadata.sequence).toBe(2)
    expect(e3.metadata.sequence).toBe(1)
    expect(e4.metadata.sequence).toBe(2)
  })

  it('union merge combines events from both devices without data loss', async () => {
    const engine1 = createMockEngine()
    const engine2 = createMockEngine()

    const log1 = createEventLog({
      storeName: 'shared',
      getAccessToken: () => null,
      deviceId: 'device-A',
      engine: engine1,
    })

    const log2 = createEventLog({
      storeName: 'shared',
      getAccessToken: () => null,
      deviceId: 'device-B',
      engine: engine2,
    })

    // Simulate both devices appending events locally
    await log1.append('task.created', { title: 'From device A' })
    await log1.append('task.done', { title: 'Done on A' })
    await log2.append('task.created', { title: 'From device B' })

    // Get events from each device
    const eventsA = await log1.list()
    const eventsB = await log2.list()

    expect(eventsA).toHaveLength(2)
    expect(eventsB).toHaveLength(1)

    // Simulate sync: merge both sets
    const merged = unionMerge(eventsA, eventsB)

    // All 3 events should be present — no data loss
    expect(merged).toHaveLength(3)
    const payloads = merged.map((e) => e.payload)
    expect(payloads).toContainEqual({ title: 'From device A' })
    expect(payloads).toContainEqual({ title: 'Done on A' })
    expect(payloads).toContainEqual({ title: 'From device B' })
  })

  it('event ordering is deterministic after merge', async () => {
    const engine1 = createMockEngine()
    const engine2 = createMockEngine()

    const log1 = createEventLog({
      storeName: 'shared',
      getAccessToken: () => null,
      deviceId: 'device-A',
      engine: engine1,
    })

    const log2 = createEventLog({
      storeName: 'shared',
      getAccessToken: () => null,
      deviceId: 'device-B',
      engine: engine2,
    })

    // Append with small delays so ULIDs differ
    await log1.append('first', {})
    await new Promise((r) => setTimeout(r, 2))
    await log2.append('second', {})
    await new Promise((r) => setTimeout(r, 2))
    await log1.append('third', {})

    const eventsA = await log1.list()
    const eventsB = await log2.list()

    // Merge and sort by ULID (same as EventLog.list does)
    const merged = unionMerge(eventsA, eventsB)
      .sort((a, b) => a.id.localeCompare(b.id))

    // Order should be: first, second, third (by creation time via ULID)
    expect(merged.map((e) => e.type)).toEqual(['first', 'second', 'third'])

    // Re-sorting produces the same order (deterministic)
    const resorted = [...merged].sort((a, b) => a.id.localeCompare(b.id))
    expect(resorted.map((e) => e.id)).toEqual(merged.map((e) => e.id))
  })
})
