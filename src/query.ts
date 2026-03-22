import type { EventRecord, EventQuery } from './types'

/**
 * Filter events by type, time range, and/or custom predicate.
 *
 * All filters are ANDed together — an event must pass every
 * specified filter to be included in the result.
 */
export function queryEvents<TPayload = unknown>(
  events: EventRecord<TPayload>[],
  query: EventQuery<TPayload>,
): EventRecord<TPayload>[] {
  let result = events

  if (query.type !== undefined) {
    result = result.filter((e) => e.type === query.type)
  }

  if (query.after !== undefined) {
    const after = query.after
    result = result.filter((e) => e.metadata.timestamp > after)
  }

  if (query.before !== undefined) {
    const before = query.before
    result = result.filter((e) => e.metadata.timestamp < before)
  }

  if (query.filter !== undefined) {
    result = result.filter(query.filter)
  }

  return result
}
