-- Required for Supabase Realtime to correctly apply RLS when filtering
-- postgres_changes events. Without REPLICA IDENTITY FULL, UPDATE events
-- do not carry the old row values, so Supabase cannot verify the SELECT
-- policy on the changed row and silently drops the event for subscribers.
ALTER TABLE pings          REPLICA IDENTITY FULL;
ALTER TABLE rsvps          REPLICA IDENTITY FULL;
ALTER TABLE places         REPLICA IDENTITY FULL;
ALTER TABLE votes          REPLICA IDENTITY FULL;
ALTER TABLE group_members  REPLICA IDENTITY FULL;
