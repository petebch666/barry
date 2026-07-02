-- Lets the group request another round of nearby-place suggestions if the
-- first batch doesn't have anything they like.
--
-- pings.places_batch is bumped by request_more_places() (called by any "in"
-- member, not just the creator/admin — hence SECURITY DEFINER with its own
-- authorization check instead of relying on the "creator or admin" RLS
-- policy on pings). Bumping it re-triggers the *existing*
-- fetch-nearby-places-webhook (which already fires on any UPDATE of
-- pings), so no new Dashboard webhook is needed.
--
-- places.batch records which round introduced each row, so
-- fetch-nearby-places can tell whether it has already handled the ping's
-- current places_batch value (idempotency) without needing a separate
-- tracking table.

ALTER TABLE pings
  ADD COLUMN places_batch INTEGER NOT NULL DEFAULT 1
    CHECK (places_batch >= 1 AND places_batch <= 3);

ALTER TABLE places
  ADD COLUMN batch INTEGER NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION request_more_places(p_ping_id UUID)
RETURNS pings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result pings;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM rsvps
    WHERE ping_id = p_ping_id AND user_id = auth.uid() AND status = 'in'
  ) THEN
    RAISE EXCEPTION 'Only "in" members can request more places';
  END IF;

  UPDATE pings
  SET places_batch = places_batch + 1
  WHERE id = p_ping_id AND status = 'voting' AND places_batch < 3
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION request_more_places(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_more_places(UUID) TO authenticated;
