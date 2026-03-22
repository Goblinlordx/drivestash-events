# Changelog

## 0.0.1 (2026-03-22)

Initial release.

### Features

- **Event log** — `createEventLog()` factory with append-only semantics
- **ULID IDs** — Time-sortable, globally unique event identifiers
- **Multi-device sync** — Union merge strategy via drivestash (Google Drive + IndexedDB)
- **Projections** — `project()` function to fold events into derived state
- **Queries** — `queryEvents()` to filter by type, time range, or custom predicate
- **Subscriptions** — `subscribe()` for local appends and sync-arrived events
- **Device identity** — `getDeviceId()` for persistent per-browser device tracking
- **Zero dependencies** — Only drivestash as a peer dependency
