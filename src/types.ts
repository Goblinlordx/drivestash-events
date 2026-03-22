import type { SyncEngine, SyncRecord } from 'drivestash'

/** Metadata attached to every event, identifying its origin and order. */
export interface EventMetadata {
  /** Unique identifier for the device/instance that created this event. */
  readonly deviceId: string
  /** ISO 8601 timestamp when the event was created. */
  readonly timestamp: string
  /** Per-device monotonic sequence number for ordering. */
  readonly sequence: number
}

/**
 * An immutable event record stored via drivestash.
 *
 * Extends SyncRecord so it can be persisted directly in a SyncEngine.
 * The `updatedAt` field is set once at creation and never changes —
 * this makes LWW merge equivalent to union merge for events.
 */
export interface EventRecord<TPayload = unknown> extends SyncRecord {
  /** Globally unique event ID (ULID — sortable by creation time). */
  readonly id: string
  /** ISO 8601 creation timestamp (same as metadata.timestamp). */
  readonly updatedAt: string
  /** Event type discriminator (e.g. "todo.created", "stamp.added"). */
  readonly type: string
  /** Event-specific data. */
  readonly payload: TPayload
  /** Origin and ordering metadata. */
  readonly metadata: EventMetadata
}

/** Query filter for retrieving a subset of events. */
export interface EventQuery<TPayload = unknown> {
  /** Filter by exact event type match. */
  type?: string
  /** Include only events after this ISO timestamp (exclusive). */
  after?: string
  /** Include only events before this ISO timestamp (exclusive). */
  before?: string
  /** Custom predicate filter. */
  filter?: (event: EventRecord<TPayload>) => boolean
}

/** Clock interface for injectable time. Defaults to system clock (Date.now). */
export interface Clock {
  /** Returns current time in milliseconds since epoch. */
  now(): number
}

/** Configuration for creating an EventLog instance. */
export interface EventLogConfig<TPayload = unknown> {
  /** Name for the underlying drivestash store. */
  storeName: string
  /** Returns a Google OAuth2 access token, or null if unauthenticated. */
  getAccessToken: () => string | null
  /** Optional device ID. Auto-generated if not provided. */
  deviceId?: string
  /** Optional pre-configured SyncEngine. Useful for testing with mocks or custom storage. */
  engine?: SyncEngine<EventRecord<TPayload>>
  /** Optional clock for injectable time. Defaults to system clock. */
  clock?: Clock
}
