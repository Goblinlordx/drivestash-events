import type { SyncRecord } from 'drivestash'

/**
 * Append-only union merge for immutable events.
 *
 * Combines local and remote record arrays by ID. Since events are
 * immutable (same ID = identical content), there are no true conflicts.
 * Local copy is kept when both sides have the same ID.
 *
 * This replaces drivestash's default LWW merge to make the append-only
 * semantics explicit and ensure no event is ever lost during sync.
 */
export function unionMerge<T extends SyncRecord>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>()
  for (const record of local) {
    merged.set(record.id, record)
  }
  for (const record of remote) {
    if (!merged.has(record.id)) {
      merged.set(record.id, record)
    }
  }
  return Array.from(merged.values())
}
