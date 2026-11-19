// Single place every unexpected error goes through, so a crash reporter
// (Sentry) can be plugged in here without touching call sites.
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error('[barry]', error, context ?? '');
}
