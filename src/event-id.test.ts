import { describe, it, expect } from 'vitest'
import { createEventId } from './event-id'

describe('createEventId', () => {
  it('returns a string', () => {
    const id = createEventId()
    expect(typeof id).toBe('string')
  })

  it('returns unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createEventId()))
    expect(ids.size).toBe(100)
  })

  it('returns a valid UUID format', () => {
    const id = createEventId()
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })
})
