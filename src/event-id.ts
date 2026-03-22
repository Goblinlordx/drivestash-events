/** Create a globally unique event ID using crypto.randomUUID. */
export function createEventId(): string {
  return crypto.randomUUID()
}
