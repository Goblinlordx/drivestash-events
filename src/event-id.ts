const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford Base32

/**
 * Encode a millisecond timestamp as 10 Crockford Base32 characters.
 * ULID timestamps are big-endian: most-significant digit first.
 */
function encodeTime(ms: number): string {
  let value = ms
  let out = ''
  for (let i = 0; i < 10; i++) {
    out = ENCODING[value % 32] + out
    value = Math.floor(value / 32)
  }
  return out
}

/**
 * Generate 16 random Crockford Base32 characters.
 */
function encodeRandom(): string {
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < 16; i++) {
    out += ENCODING[bytes[i % 10] & 31]
  }
  return out
}

/**
 * Create a ULID (Universally Unique Lexicographically Sortable Identifier).
 *
 * Format: 10 chars timestamp (ms) + 16 chars random = 26 chars total.
 * ULIDs sort lexicographically by creation time, making them ideal for
 * event log ordering without needing a separate timestamp comparison.
 */
export function createEventId(): string {
  return encodeTime(Date.now()) + encodeRandom()
}
