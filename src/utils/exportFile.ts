export function exportFileName(now: Date): string {
  return `barry-export-${now.toISOString().slice(0, 10)}.json`;
}

export function formatExport(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
