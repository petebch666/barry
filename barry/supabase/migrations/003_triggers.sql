-- ============================================================
-- Barry — triggers and scheduled jobs
-- ============================================================

-- ─── Auto-create profile on sign-up ─────────────────────────
-- Runs as the superuser (SECURITY DEFINER) so it can write to profiles
-- even before the user's JWT is available.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER rsvps_updated_at
  BEFORE UPDATE ON rsvps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Location data retention ─────────────────────────────────
-- Nullifies lat/lng on rsvps once a ping reaches a terminal state.
-- Runs every 30 minutes via pg_cron (enabled separately in Supabase dashboard).
-- The cron expression is registered below if pg_cron is available.

CREATE OR REPLACE FUNCTION nullify_terminal_ping_locations()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE rsvps
  SET
    latitude            = NULL,
    longitude           = NULL,
    location_updated_at = NULL
  WHERE ping_id IN (
    SELECT id FROM pings
    WHERE status IN ('confirmed', 'cancelled')
  )
  AND (latitude IS NOT NULL OR longitude IS NOT NULL);
$$;

-- ─── Ping expiry ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_expired_pings()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE pings
  SET status = 'cancelled'
  WHERE status IN ('open', 'voting')
    AND expires_at < NOW();
$$;

-- Register pg_cron jobs if the extension is enabled.
-- In Supabase, enable pg_cron via: Extensions → pg_cron.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Cancel expired pings every 30 minutes
    PERFORM cron.schedule(
      'barry-expire-pings',
      '*/30 * * * *',
      'SELECT cancel_expired_pings()'
    );
    -- Nullify location data every 30 minutes
    PERFORM cron.schedule(
      'barry-nullify-locations',
      '*/30 * * * *',
      'SELECT nullify_terminal_ping_locations()'
    );
  END IF;
END;
$$;
