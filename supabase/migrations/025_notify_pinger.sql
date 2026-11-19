-- First iPhone test: the pinger heard nothing when friends answered or left.
-- notify-pinger tells them who answered and how, and when everyone else in
-- the group has answered. Two triggers because a WHEN clause can't read OLD
-- on INSERT.

CREATE TRIGGER notify_pinger_on_answer
  AFTER INSERT ON rsvps
  FOR EACH ROW EXECUTE FUNCTION call_edge_function('notify-pinger');

CREATE TRIGGER notify_pinger_on_change
  AFTER UPDATE ON rsvps
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION call_edge_function('notify-pinger');
