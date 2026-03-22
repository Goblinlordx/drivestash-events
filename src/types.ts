import type { SyncRecord } from 'drivestash'

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

/** Configuration for creating an EventLog instance. */
export interface EventLogConfig {
  /** Name for the underlying drivestash store. */
  storeName: string
  /** Returns a Google OAuth2 access token, or null if unauthenticated. */
  getAccessToken: () => string | null
  /** Optional device ID. Auto-generated if not provided. */
  deviceId?: string
}
