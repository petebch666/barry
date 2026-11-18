import { exportFileName, formatExport } from '@/utils/exportFile';

describe('exportFileName', () => {
  it('names the file after the UTC export date', () => {
    expect(exportFileName(new Date('2026-11-18T23:30:00Z'))).toBe('barry-export-2026-11-18.json');
  });
});

describe('formatExport', () => {
  it('produces indented JSON that parses back to the same data', () => {
    const data = { profile: { display_name: 'Bob' }, rsvps: [] };
    const text = formatExport(data);
    expect(text).toContain('\n  "profile"');
    expect(JSON.parse(text)).toEqual(data);
  });
});
