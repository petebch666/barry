let seq = 0;

// supabase.channel() returns the existing channel when a topic is reused. On a
// fast remount (React dev mode mounts effects twice) the old channel is still
// subscribed while removeChannel() finishes, so .on() on it throws. A unique
// topic per subscription sidesteps that; postgres_changes routing uses the
// table/filter, not the topic, so nothing else changes.
export function uniqueTopic(base: string): string {
  seq += 1;
  return `${base}:${seq}`;
}
