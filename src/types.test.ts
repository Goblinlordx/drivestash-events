import { describe, it, expect } from 'vitest'
import type { SyncRecord } from 'drivestash'
import type { EventRecord, EventMetadata, EventLogConfig } from './types'

describe('EventRecord type constraints', () => {
  it('EventRecord extends SyncRecord', () => {
    // Type-level test: EventRecord must be assignable to SyncRecord
    const event: EventRecord = {
      id: 'test-id',
      updatedAt: '2026-01-01T00:00:00.000Z',
      type: 'test',
      payload: {},
      metadata: {
        deviceId: 'device-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        sequence: 0,
      },
    }
    const _syncRecord: SyncRecord = event
    expect(_syncRecord.id).toBe('test-id')
    expect(_syncRecord.updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('EventRecord preserves generic payload type', () => {
    interface TodoPayload {
      title: string
      done: boolean
    }
    const event: EventRecord<TodoPayload> = {
      id: 'todo-1',
      updatedAt: '2026-01-01T00:00:00.000Z',
      type: 'todo.created',
      payload: { title: 'Buy milk', done: false },
      metadata: {
        deviceId: 'device-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        sequence: 1,
      },
    }
    expect(event.payload.title).toBe('Buy milk')
    expect(event.payload.done).toBe(false)
  })

  it('EventMetadata has required fields', () => {
    const meta: EventMetadata = {
      deviceId: 'dev-abc',
      timestamp: '2026-01-01T00:00:00.000Z',
      sequence: 42,
    }
    expect(meta.deviceId).toBe('dev-abc')
    expect(meta.timestamp).toBe('2026-01-01T00:00:00.000Z')
    expect(meta.sequence).toBe(42)
  })

  it('EventLogConfig has required fields', () => {
    const config: EventLogConfig = {
      storeName: 'my-events',
      getAccessToken: () => 'token',
      deviceId: 'device-1',
    }
    expect(config.storeName).toBe('my-events')
    expect(config.getAccessToken()).toBe('token')
    expect(config.deviceId).toBe('device-1')
  })

  it('EventLogConfig deviceId is optional', () => {
    const config: EventLogConfig = {
      storeName: 'my-events',
      getAccessToken: () => null,
    }
    expect(config.deviceId).toBeUndefined()
  })
})
