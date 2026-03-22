import { describe, it, expect } from 'vitest'
import type { EventRecord } from './types'
import { queryEvents } from './query'

function makeEvent(
  type: string,
  timestamp: string,
  payload: unknown = {},
  id = '01TEST' + timestamp.replace(/\D/g, '').slice(0, 20),
): EventRecord {
  return {
    id,
    updatedAt: timestamp,
    type,
    payload,
    metadata: { deviceId: 'd1', timestamp, sequence: 1 },
  }
}

const events: EventRecord[] = [
  makeEvent('todo.created', '2026-01-01T10:00:00.000Z', { title: 'A' }),
  makeEvent('todo.created', '2026-01-02T10:00:00.000Z', { title: 'B' }),
  makeEvent('todo.completed', '2026-01-03T10:00:00.000Z', { title: 'A' }),
  makeEvent('note.created', '2026-01-04T10:00:00.000Z', { title: 'C' }),
]

describe('queryEvents', () => {
  it('returns all events with empty query', () => {
    expect(queryEvents(events, {})).toHaveLength(4)
  })

  it('filters by type', () => {
    const result = queryEvents(events, { type: 'todo.created' })
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.type === 'todo.created')).toBe(true)
  })

  it('filters by after timestamp (exclusive)', () => {
    const result = queryEvents(events, { after: '2026-01-02T10:00:00.000Z' })
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('todo.completed')
    expect(result[1].type).toBe('note.created')
  })

  it('filters by before timestamp (exclusive)', () => {
    const result = queryEvents(events, { before: '2026-01-03T10:00:00.000Z' })
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('todo.created')
  })

  it('filters by time range (after + before)', () => {
    const result = queryEvents(events, {
      after: '2026-01-01T10:00:00.000Z',
      before: '2026-01-04T10:00:00.000Z',
    })
    expect(result).toHaveLength(2)
  })

  it('filters by custom predicate', () => {
    const result = queryEvents(events, {
      filter: (e) => (e.payload as { title: string }).title === 'A',
    })
    expect(result).toHaveLength(2)
  })

  it('combines type + time range + custom filter', () => {
    const result = queryEvents(events, {
      type: 'todo.created',
      after: '2026-01-01T09:00:00.000Z',
      before: '2026-01-02T11:00:00.000Z',
      filter: (e) => (e.payload as { title: string }).title === 'B',
    })
    expect(result).toHaveLength(1)
    expect((result[0].payload as { title: string }).title).toBe('B')
  })

  it('returns empty array when no events match', () => {
    expect(queryEvents(events, { type: 'nonexistent' })).toHaveLength(0)
  })
})
