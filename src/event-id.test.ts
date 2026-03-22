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

  it('accepts explicit ms timestamp for deterministic IDs', () => {
    const fixedMs = new Date('2026-01-01T00:00:00.000Z').getTime()
    const id1 = createEventId(fixedMs)
    const id2 = createEventId(fixedMs)
    // Same timestamp → same 10-char prefix
    expect(id1.slice(0, 10)).toBe(id2.slice(0, 10))
    // Random suffix differs
    expect(id1).not.toBe(id2)
  })

  it('IDs created in quick succession have similar timestamp prefixes', () => {
    const ids = Array.from({ length: 10 }, () => createEventId())
    // At most 2 distinct prefixes (if we cross a millisecond boundary)
    const prefixes = new Set(ids.map((id) => id.slice(0, 10)))
    expect(prefixes.size).toBeLessThanOrEqual(2)
  })
})
