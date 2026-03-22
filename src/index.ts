// drivestash-events — public API barrel export

// Re-export drivestash types for DI / custom storage (no need to depend on drivestash directly)
export type {
  SyncEngine,
  SyncRecord,
  SyncEngineOptions,
  LocalStorePort,
  DriveAdapterPort,
  SyncStatusListener,
} from 'drivestash'

export type { EventRecord, EventMetadata, EventLogConfig, EventQuery } from './types'
export { createEventId } from './event-id'
export { createEventLog } from './event-log'
export type { EventLog, EventListener } from './event-log'
export { project } from './projection'
export type { Projector } from './projection'
export { queryEvents } from './query'
export { unionMerge } from './union-merge'
export { getDeviceId } from './device-id'
