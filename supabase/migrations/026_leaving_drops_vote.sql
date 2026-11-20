-- Leaving a ping (an "in" RSVP becoming "out" or "maybe") now removes the
-- person's vote and re-checks the majority. Before, a leaver's vote still
-- counted while the majority was measured against the people still in, and
-- nothing re-checked it when someone left, even if those remaining agreed.

-- SECURITY DEFINER: runs whoever changed the RSVP, including the cron that
-- cancels pings; the votes policies only let users touch their own rows.
CREATE OR REPLACE FUNCTION drop_vote_on_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM votes WHERE ping_id = NEW.ping_id AND user_id = NEW.user_id;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION drop_vote_on_leave() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER drop_vote_on_leave
  AFTER UPDATE ON rsvps
  FOR EACH ROW WHEN (OLD.status = 'in' AND NEW.status IS DISTINCT FROM 'in')
  EXECUTE FUNCTION drop_vote_on_leave();

-- check-vote-majority only reads record.ping_id, so an RSVP row works. The
-- request is sent after commit, so it sees the vote already removed.
CREATE TRIGGER recheck_majority_on_leave
  AFTER UPDATE ON rsvps
  FOR EACH ROW WHEN (OLD.status = 'in' AND NEW.status IS DISTINCT FROM 'in')
  EXECUTE FUNCTION call_edge_function('check-vote-majority');
