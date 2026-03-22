import { describe, it, expect, vi } from 'vitest'
import type { SyncEngine, SyncStatusListener } from 'drivestash'
import type { EventRecord } from './types'
import type { Projector } from './projection'
import { project } from './projection'
import { createEventLog } from './event-log'

function makeEvent(type: string, payload: unknown, id = '01TEST000000AAAAAAAAAAAAA'): EventRecord {
  return {
    id,
    updatedAt: '2026-01-01T00:00:00.000Z',
    type,
    payload,
    metadata: { deviceId: 'd1', timestamp: '2026-01-01T00:00:00.000Z', sequence: 1 },
  }
}

describe('project()', () => {
  it('returns init state for empty events', () => {
    const counter: Projector<number> = {
      init: 0,
      apply: (state) => state + 1,
    }
    expect(project([], counter)).toBe(0)
  })

  it('folds a single event', () => {
    const counter: Projector<number> = {
      init: 0,
      apply: (state) => state + 1,
    }
    const events = [makeEvent('tick', {})]
    expect(project(events, counter)).toBe(1)
  })

  it('folds multiple events in order', () => {
    const sum: Projector<number, { amount: number }> = {
      init: 0,
      apply: (state, event) => state + event.payload.amount,
    }
    const events = [
      makeEvent('deposit', { amount: 100 }, '01A'),
      makeEvent('deposit', { amount: 50 }, '01B'),
      makeEvent('withdraw', { amount: -30 }, '01C'),
    ]
    expect(project(events, sum)).toBe(120)
  })

  it('works with object state', () => {
    interface TodoState {
      items: string[]
      count: number
    }
    const todoProjector: Projector<TodoState, { title: string }> = {
      init: { items: [], count: 0 },
      apply: (state, event) => ({
        items: [...state.items, event.payload.title],
        count: state.count + 1,
      }),
    }
    const events = [
      makeEvent('todo.added', { title: 'Buy milk' }, '01A'),
      makeEvent('todo.added', { title: 'Walk dog' }, '01B'),
    ]
    const result = project(events, todoProjector)
    expect(result.items).toEqual(['Buy milk', 'Walk dog'])
    expect(result.count).toBe(2)
  })

  it('projector can filter by event type', () => {
    const stampsOnly: Projector<Set<string>, { itemId: string }> = {
      init: new Set(),
      apply: (state, event) => {
        if (event.type === 'stamp.added') {
          return new Set([...state, event.payload.itemId])
        }
        return state
      },
    }
    const events = [
      makeEvent('stamp.added', { itemId: 'a' }, '01A'),
      makeEvent('other', { itemId: 'b' }, '01B'),
      makeEvent('stamp.added', { itemId: 'c' }, '01C'),
    ]
    const result = project(events, stampsOnly)
    expect(result.size).toBe(2)
    expect(result.has('a')).toBe(true)
    expect(result.has('c')).toBe(true)
  })
})

function createMockEngine(): SyncEngine<EventRecord> & { _records: Map<string, EventRecord> } {
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
    onStatusChange: vi.fn((_l: SyncStatusListener) => () => {}),
    clear: vi.fn(async () => { records.clear() }),
    destroy: vi.fn(),
  }
}

describe('EventLog.project() integration', () => {
  it('projects all appended events through a projector', async () => {
    const engine = createMockEngine()
    const log = createEventLog({
      storeName: 'test',
      getAccessToken: () => null,
      deviceId: 'device-1',
    }, { engine })

    await log.append('deposit', { amount: 100 })
    await log.append('deposit', { amount: 50 })
    await log.append('withdraw', { amount: -25 })

    const balance: Projector<number, { amount: number }> = {
      init: 0,
      apply: (state, event) => state + event.payload.amount,
    }

    const result = await log.project(balance)
    expect(result).toBe(125)
  })
})
