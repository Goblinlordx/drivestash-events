import { describe, it, expect } from 'vitest'
import { createEventId } from './event-id'

describe('createEventId', () => {
  it('returns a 26-character string', () => {
    const id = createEventId()
    expect(typeof id).toBe('string')
    expect(id).toHaveLength(26)
  })

  it('returns unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createEventId()))
    expect(ids.size).toBe(100)
  })

  it('uses only Crockford Base32 characters', () => {
    const id = createEventId()
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('sorts lexicographically by creation time', async () => {
    const first = createEventId()
    // Small delay to ensure different millisecond
    await new Promise((r) => setTimeout(r, 2))
    const second = createEventId()
    expect(first < second).toBe(true)
  })

  it('IDs created at same millisecond share timestamp prefix', () => {
    const ids = Array.from({ length: 10 }, () => createEventId())
    const prefix = ids[0].slice(0, 10)
    // All IDs generated in quick succession should share the same 10-char timestamp
    // (within the same millisecond)
    for (const id of ids) {
      expect(id.slice(0, 10)).toBe(prefix)
    }
  })
})
