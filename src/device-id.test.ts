import { describe, it, expect, beforeEach } from 'vitest'
import { getDeviceId } from './device-id'

// Mock localStorage for Node/Vitest environment
const store = new Map<string, string>()
const mockStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
}

describe('getDeviceId', () => {
  beforeEach(() => {
    store.clear()
  })

  it('generates a new device ID when none exists', () => {
    const id = getDeviceId(mockStorage)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('persists the device ID to storage', () => {
    const id = getDeviceId(mockStorage)
    expect(store.get('drivestash-events:deviceId')).toBe(id)
  })

  it('returns the same ID on subsequent calls', () => {
    const first = getDeviceId(mockStorage)
    const second = getDeviceId(mockStorage)
    expect(first).toBe(second)
  })

  it('returns a previously stored ID', () => {
    store.set('drivestash-events:deviceId', 'existing-device')
    const id = getDeviceId(mockStorage)
    expect(id).toBe('existing-device')
  })

  it('generates unique IDs across instances', () => {
    const store2 = new Map<string, string>()
    const mockStorage2: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: (key: string) => store2.get(key) ?? null,
      setItem: (key: string, value: string) => { store2.set(key, value) },
    }

    const id1 = getDeviceId(mockStorage)
    const id2 = getDeviceId(mockStorage2)
    expect(id1).not.toBe(id2)
  })
})
