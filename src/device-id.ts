const STORAGE_KEY = 'drivestash-events:deviceId'

/**
 * Get or generate a persistent device identifier.
 *
 * The device ID is generated once per browser instance using
 * crypto.randomUUID() and persisted in localStorage. This identifies
 * the originating device for each event, enabling per-device ordering
 * and cross-device merge tracking.
 *
 * @param storage - Storage backend (defaults to window.localStorage)
 */
export function getDeviceId(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): string {
  const existing = storage.getItem(STORAGE_KEY)
  if (existing) return existing

  const id = crypto.randomUUID()
  storage.setItem(STORAGE_KEY, id)
  return id
}
