-- The groups INSERT runs as one request (.insert().select().single()), then
-- the group_members INSERT runs as a second request. Between those two requests,
-- the creator is not yet in group_members, so is_group_member(id) returns false
-- and PostgREST rejects the RETURNING clause with 403 (can write but can't read).
-- Fix: also allow the creator to see their own group.
DROP POLICY IF EXISTS "groups: members can read" ON groups;
CREATE POLICY "groups: members can read"
  ON groups FOR SELECT
  USING (is_group_member(id) OR created_by = auth.uid());
