-- Beta metrics: how pings actually go, read by the developer from the SQL
-- editor or `supabase db query --remote --read-only "select * from beta.…"`.
--
-- Two facts the schema didn't keep:
--   pings.decided_at      when a ping was confirmed or cancelled
--   rsvps.shared_location whether a location was ever shared on this RSVP.
--                         A yes/no only: the coordinates themselves are still
--                         erased when the ping ends (003), and this flag
--                         deliberately survives that.

ALTER TABLE pings ADD COLUMN decided_at TIMESTAMPTZ;
ALTER TABLE rsvps ADD COLUMN shared_location BOOLEAN NOT NULL DEFAULT false;

UPDATE rsvps SET shared_location = true WHERE latitude IS NOT NULL;

CREATE OR REPLACE FUNCTION stamp_ping_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('confirmed', 'cancelled') AND OLD.status NOT IN ('confirmed', 'cancelled') THEN
    NEW.decided_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ping_decided
  BEFORE UPDATE OF status ON pings
  FOR EACH ROW EXECUTE FUNCTION stamp_ping_decision();

CREATE OR REPLACE FUNCTION flag_shared_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Never reset: the cron job nulls the coordinates after the ping ends.
  NEW.shared_location := NEW.latitude IS NOT NULL
    OR (TG_OP = 'UPDATE' AND OLD.shared_location);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_rsvp_location
  BEFORE INSERT OR UPDATE ON rsvps
  FOR EACH ROW EXECUTE FUNCTION flag_shared_location();

REVOKE EXECUTE ON FUNCTION stamp_ping_decision() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION flag_shared_location() FROM PUBLIC, anon, authenticated;

-- Not in the API's exposed schemas (config.toml: public, graphql_public), and
-- no grants to client roles: only postgres / service_role can read it.
CREATE SCHEMA beta;
REVOKE ALL ON SCHEMA beta FROM PUBLIC, anon, authenticated;

-- One row per week: how far pings got.
CREATE VIEW beta.ping_funnel AS
SELECT
  date_trunc('week', p.created_at)::date AS week,
  count(*) AS pings,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM rsvps r WHERE r.ping_id = p.id AND r.status = 'in' AND r.user_id IS DISTINCT FROM p.created_by
  )) AS got_an_in_from_someone_else,
  count(*) FILTER (WHERE p.voting_deadline IS NOT NULL OR p.status IN ('voting', 'confirmed')) AS reached_voting,
  count(*) FILTER (WHERE p.status = 'confirmed') AS confirmed,
  count(*) FILTER (WHERE p.status = 'cancelled') AS cancelled,
  count(*) FILTER (WHERE p.status IN ('open', 'voting')) AS still_open,
  round(100.0 * count(*) FILTER (WHERE p.status = 'confirmed') / count(*), 0) AS confirmed_pct,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY p.decided_at - p.created_at)
    FILTER (WHERE p.status = 'confirmed' AND p.decided_at IS NOT NULL) AS median_time_to_confirm
FROM pings p
GROUP BY 1
ORDER BY 1 DESC;

-- One row per week: who answered, and how.
CREATE VIEW beta.rsvp_behaviour AS
SELECT
  date_trunc('week', p.created_at)::date AS week,
  count(r.id) AS rsvps,
  count(r.id) FILTER (WHERE r.status = 'in') AS answered_in,
  count(r.id) FILTER (WHERE r.status = 'maybe') AS answered_maybe,
  count(r.id) FILTER (WHERE r.status = 'out') AS answered_out,
  count(r.id) FILTER (WHERE r.status = 'in' AND r.shared_location) AS in_with_location,
  round(100.0 * count(r.id) FILTER (WHERE r.status = 'in' AND r.shared_location)
    / NULLIF(count(r.id) FILTER (WHERE r.status = 'in'), 0), 0) AS location_share_pct,
  count(DISTINCT r.user_id) AS active_people
FROM pings p JOIN rsvps r ON r.ping_id = p.id
GROUP BY 1
ORDER BY 1 DESC;

-- Feedback, newest first, with enough context to act on it.
CREATE VIEW beta.feedback_log AS
SELECT
  f.created_at,
  f.kind,
  f.rating,
  f.message,
  pr.display_name AS author,
  g.name AS group_name,
  p.message AS ping,
  p.status AS ping_status,
  f.platform,
  f.app_version
FROM feedback f
LEFT JOIN profiles pr ON pr.id = f.user_id
LEFT JOIN pings p ON p.id = f.ping_id
LEFT JOIN groups g ON g.id = p.group_id
ORDER BY f.created_at DESC;

-- Thumbs up/down after a confirmed ping, per week.
CREATE VIEW beta.outcome_ratings AS
SELECT
  date_trunc('week', f.created_at)::date AS week,
  count(*) FILTER (WHERE f.rating = 'up') AS went_well,
  count(*) FILTER (WHERE f.rating = 'down') AS went_badly,
  round(100.0 * count(*) FILTER (WHERE f.rating = 'up') / NULLIF(count(*), 0), 0) AS went_well_pct
FROM feedback f
WHERE f.kind = 'ping_outcome'
GROUP BY 1
ORDER BY 1 DESC;
