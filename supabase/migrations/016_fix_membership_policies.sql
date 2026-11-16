-- Fixes two RLS holes from 002_rls_policies.sql, found when the pgTAP suite
-- first ran against a real database.
--
-- 1. group_members: the admin checks read
--      EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id ...)
--    Inside the subquery the bare `group_id` resolves to gm.group_id, so the
--    condition compared a column with itself and meant "caller is an admin of
--    ANY group". Anyone can create a group and become its admin, so anyone
--    could add, re-role or delete memberships in every group. The self-join
--    branch also accepted any role, so a joiner could insert themselves as
--    admin.
-- 2. rsvps: insert/update only checked user_id, so anyone could RSVP "in" to a
--    ping outside their groups (sharing a location there) and, through the
--    places/votes policies that key off an "in" RSVP, add venues and vote.
--
-- Also closes the same class of gap on votes and pings updates: the new row
-- is now re-checked, so a row can't be moved somewhere the caller can't write.

-- Same shape as is_group_member(): SECURITY DEFINER so the check can read
-- group_members without recursing into group_members' own policies.
CREATE OR REPLACE FUNCTION is_group_admin(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = auth.uid() AND role = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION is_group_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_group_admin(UUID) TO authenticated;

-- ─── group_members ───────────────────────────────────────────
DROP POLICY "group_members: admins or self-join can insert" ON group_members;
DROP POLICY "group_members: admins or self can update/delete" ON group_members;
DROP POLICY "group_members: admins can update role" ON group_members;

-- useCreateGroup inserts the creator as admin right after creating the group,
-- before any membership exists, so that case is allowed via groups.created_by.
CREATE POLICY "group_members: self-join as member, creator as admin, or admin adds"
  ON group_members FOR INSERT
  WITH CHECK (
    (user_id = auth.uid() AND role = 'member')
    OR (
      user_id = auth.uid() AND role = 'admin'
      AND EXISTS (
        SELECT 1 FROM groups g
        WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
      )
    )
    OR is_group_admin(group_members.group_id)
  );

CREATE POLICY "group_members: self-leave or admin removes"
  ON group_members FOR DELETE
  USING (user_id = auth.uid() OR is_group_admin(group_id));

CREATE POLICY "group_members: admins can update"
  ON group_members FOR UPDATE
  USING (is_group_admin(group_id))
  WITH CHECK (is_group_admin(group_id));

-- ─── rsvps ───────────────────────────────────────────────────
DROP POLICY "rsvps: own row insert/update" ON rsvps;
DROP POLICY "rsvps: own row update" ON rsvps;

CREATE POLICY "rsvps: own row insert in own groups"
  ON rsvps FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pings p
      WHERE p.id = rsvps.ping_id AND is_group_member(p.group_id)
    )
  );

CREATE POLICY "rsvps: own row update in own groups"
  ON rsvps FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pings p
      WHERE p.id = rsvps.ping_id AND is_group_member(p.group_id)
    )
  );

-- ─── votes ───────────────────────────────────────────────────
DROP POLICY "votes: own row update (change vote)" ON votes;

CREATE POLICY "votes: own row update (change vote)"
  ON votes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rsvps r
      WHERE r.ping_id = votes.ping_id AND r.user_id = auth.uid() AND r.status = 'in'
    )
  );

-- ─── pings ───────────────────────────────────────────────────
DROP POLICY "pings: creator or admin can update" ON pings;

CREATE POLICY "pings: creator or admin can update"
  ON pings FOR UPDATE
  USING (created_by = auth.uid() OR is_group_admin(group_id))
  WITH CHECK (is_group_member(group_id));
