-- The Edge Functions are meant to run on database events, but only one of
-- the six webhooks had been created (by hand, in the dashboard): no push on a
-- new ping, voting start or cancellation, no auto-confirm on a majority, no
-- re-suggestion when the meeting point moves. Production had 23 cancelled
-- pings and a single confirmed one (by the vote-timer cron).
--
-- All six now live here, in git. They call the functions through pg_net with
-- the Vault secrets the vote-timer cron already uses (project_url,
-- service_role_key; see CLAUDE.md), so no key is stored in a migration. The
-- body has the shape of a Supabase database webhook, which the functions
-- already parse.

CREATE EXTENSION IF NOT EXISTS pg_net;

DROP TRIGGER IF EXISTS "fetch-nearby-places-webhook" ON pings;

-- SECURITY DEFINER: reads the Vault, which client roles can't.
CREATE OR REPLACE FUNCTION call_edge_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url TEXT;
  service_key TEXT;
BEGIN
  SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  -- Local and test databases have no secrets: skip rather than fail the write.
  IF base_url IS NULL OR service_key IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url := base_url || '/functions/v1/' || TG_ARGV[0],
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
      'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
    ),
    timeout_milliseconds := 10000
  );
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION call_edge_function() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_group_on_ping
  AFTER INSERT ON pings
  FOR EACH ROW EXECUTE FUNCTION call_edge_function('notify-group-on-ping');

-- Same scope as the old dashboard webhook: the function itself skips rounds
-- it has already fetched (places_batch).
CREATE TRIGGER fetch_nearby_places
  AFTER UPDATE ON pings
  FOR EACH ROW WHEN (NEW.status = 'voting')
  EXECUTE FUNCTION call_edge_function('fetch-nearby-places');

CREATE TRIGGER notify_voting_started
  AFTER UPDATE ON pings
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM 'voting' AND NEW.status = 'voting')
  EXECUTE FUNCTION call_edge_function('notify-voting-started');

CREATE TRIGGER notify_ping_cancelled
  AFTER UPDATE ON pings
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled')
  EXECUTE FUNCTION call_edge_function('notify-ping-cancelled');

CREATE TRIGGER check_vote_majority
  AFTER INSERT OR UPDATE ON votes
  FOR EACH ROW EXECUTE FUNCTION call_edge_function('check-vote-majority');

-- Only someone dropping out of "in" can move the meeting point.
CREATE TRIGGER notify_rsvp_change
  AFTER UPDATE ON rsvps
  FOR EACH ROW WHEN (OLD.status = 'in' AND NEW.status IS DISTINCT FROM 'in')
  EXECUTE FUNCTION call_edge_function('notify-rsvp-change');
