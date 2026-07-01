-- Optional per-ping vote timer.
--
-- When the creator sets vote_timer_minutes, voting_deadline is stamped at
-- the moment voting starts (via start_ping_voting) so check-vote-majority
-- can defer strict-majority auto-confirm until either 100% participation or
-- the deadline passes (handled by the finalize-ping-vote cron sweep).

ALTER TABLE pings
  ADD COLUMN vote_timer_minutes INTEGER NULL
    CHECK (vote_timer_minutes IS NULL OR vote_timer_minutes > 0),
  ADD COLUMN voting_deadline TIMESTAMPTZ NULL;

-- Computes the deadline server-side to avoid client clock-skew.
-- SECURITY INVOKER (default): the existing "pings: creator or admin can
-- update" RLS policy still governs who may call this.
-- WHERE status = 'open' makes the call idempotent against double-taps.
CREATE OR REPLACE FUNCTION start_ping_voting(p_ping_id UUID)
RETURNS pings
LANGUAGE sql
AS $$
  UPDATE pings
  SET status = 'voting',
      voting_deadline = CASE
        WHEN vote_timer_minutes IS NOT NULL
        THEN NOW() + (vote_timer_minutes || ' minutes')::interval
        ELSE NULL
      END
  WHERE id = p_ping_id AND status = 'open'
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION start_ping_voting(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_ping_voting(UUID) TO authenticated;
