import { describe, it, expect } from 'vitest'
import type { SyncRecord } from 'drivestash'
import { unionMerge } from './union-merge'

function record(id: string, updatedAt = '2026-01-01T00:00:00.000Z'): SyncRecord {
  return { id, updatedAt }
}

describe('unionMerge', () => {
  it('merges disjoint sets', () => {
    const local = [record('a'), record('b')]
    const remote = [record('c'), record('d')]
    const merged = unionMerge(local, remote)
    const ids = merged.map((r) => r.id).sort()
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('deduplicates overlapping IDs', () => {
    const local = [record('a'), record('b')]
    const remote = [record('b'), record('c')]
    const merged = unionMerge(local, remote)
    const ids = merged.map((r) => r.id).sort()
    expect(ids).toEqual(['a', 'b', 'c'])
  })

  it('returns empty array for two empty arrays', () => {
    expect(unionMerge([], [])).toEqual([])
  })

  it('returns local when remote is empty', () => {
    const local = [record('a')]
    expect(unionMerge(local, [])).toEqual(local)
  })

  it('returns remote when local is empty', () => {
    const remote = [record('x')]
    expect(unionMerge([], remote)).toEqual(remote)
  })

  it('preserves the local version when both sides have the same ID', () => {
    const local = [record('a', '2026-01-01T00:00:00.000Z')]
    const remote = [record('a', '2026-01-02T00:00:00.000Z')]
    const merged = unionMerge(local, remote)
    // For immutable events, same ID = same event, but we keep local copy
    expect(merged).toHaveLength(1)
    expect(merged[0].updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('handles large merge without duplicates', () => {
    const local = Array.from({ length: 500 }, (_, i) => record(`l-${i}`))
    const remote = Array.from({ length: 500 }, (_, i) => record(`r-${i}`))
    const merged = unionMerge(local, remote)
    expect(merged).toHaveLength(1000)
  })
})
