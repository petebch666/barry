import { uniqueTopic } from '@/lib/realtime';

describe('uniqueTopic', () => {
  it('keeps the base name as a prefix', () => {
    expect(uniqueTopic('feed-pings')).toMatch(/^feed-pings:\d+$/);
  });

  it('never repeats a topic for the same base', () => {
    const a = uniqueTopic('rsvps:ping-1');
    const b = uniqueTopic('rsvps:ping-1');
    expect(a).not.toBe(b);
  });
});
