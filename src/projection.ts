import type { EventRecord } from './types'

/**
 * A projector folds an ordered event stream into derived state.
 *
 * @typeParam TState - The projected state type
 * @typeParam TPayload - The event payload type (defaults to unknown)
 */
export interface Projector<TState, TPayload = unknown> {
  /** The initial state before any events are applied. */
  readonly init: TState
  /** Apply a single event to the current state, returning the next state. */
  apply(state: TState, event: EventRecord<TPayload>): TState
}

/**
 * Replay events through a projector to derive state.
 *
 * Events are folded left-to-right (earliest first) using the projector's
 * apply function. The caller is responsible for providing events in the
 * correct order (EventLog.list() already sorts by ULID).
 */
export function project<TState, TPayload = unknown>(
  events: EventRecord<TPayload>[],
  projector: Projector<TState, TPayload>,
): TState {
  return events.reduce(
    (state, event) => projector.apply(state, event),
    projector.init,
  )
}
