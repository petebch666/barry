-- delete_user() (004) failed for anyone who had created a group, sent a ping
-- or suggested a venue: those columns referenced profiles with no ON DELETE
-- rule, so the cascade from auth.users was blocked.
--
-- Shared history belongs to the group, so it stays: the creator columns become
-- nullable and are cleared on deletion. A group never loses its last admin
-- while it still has members, and a group left with no members is removed,
-- since nobody could see it any more.

ALTER TABLE groups ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE groups DROP CONSTRAINT groups_created_by_fkey;
ALTER TABLE groups ADD CONSTRAINT groups_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE pings ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE pings DROP CONSTRAINT pings_created_by_fkey;
ALTER TABLE pings ADD CONSTRAINT pings_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE places DROP CONSTRAINT places_suggested_by_fkey;
ALTER TABLE places ADD CONSTRAINT places_suggested_by_fkey
  FOREIGN KEY (suggested_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Runs for every membership removal (leaving a group, being removed, or the
-- cascade from account deletion), so the rule holds on every path.
-- SECURITY DEFINER: the departing member can't update other members' roles
-- under RLS.
CREATE OR REPLACE FUNCTION handle_member_departure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = OLD.group_id) THEN
    DELETE FROM groups WHERE id = OLD.group_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = OLD.group_id AND role = 'admin'
  ) THEN
    UPDATE group_members SET role = 'admin'
    WHERE (group_id, user_id) = (
      SELECT group_id, user_id FROM group_members
      WHERE group_id = OLD.group_id
      ORDER BY joined_at, user_id
      LIMIT 1
    );
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION handle_member_departure() FROM PUBLIC;

CREATE TRIGGER on_group_member_departure
  AFTER DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION handle_member_departure();
