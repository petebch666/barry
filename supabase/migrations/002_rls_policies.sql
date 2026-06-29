-- ============================================================
-- Barry — Row Level Security policies
-- ============================================================

-- ─── Helper function ─────────────────────────────────────────
-- Used in multiple policies to avoid repeating the join.
-- SECURITY DEFINER runs as the function owner (bypasses RLS on group_members),
-- but the result exposes nothing sensitive — it's a boolean membership check.
CREATE OR REPLACE FUNCTION is_group_member(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = auth.uid()
  )
$$;

-- ─── Enable RLS ──────────────────────────────────────────────
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE places         ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_places   ENABLE ROW LEVEL SECURITY;

-- ─── profiles ────────────────────────────────────────────────
-- Any authenticated user can read any profile (needed to display member lists).
CREATE POLICY "profiles: any auth user can read"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can only update their own profile.
CREATE POLICY "profiles: own row update"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT is handled by the trigger in 003_triggers.sql — no direct INSERT needed.

-- ─── push_tokens ─────────────────────────────────────────────
CREATE POLICY "push_tokens: own rows"
  ON push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── groups ──────────────────────────────────────────────────
CREATE POLICY "groups: members can read"
  ON groups FOR SELECT
  USING (is_group_member(id));

CREATE POLICY "groups: any auth user can create"
  ON groups FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Only admins of the group can update group metadata.
CREATE POLICY "groups: admins can update"
  ON groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── group_members ───────────────────────────────────────────
CREATE POLICY "group_members: members can read"
  ON group_members FOR SELECT
  USING (is_group_member(group_id));

-- Admins can add members; users can also insert themselves when accepting an invite
-- (join/[code].tsx inserts a row with the caller's own user_id).
CREATE POLICY "group_members: admins or self-join can insert"
  ON group_members FOR INSERT
  WITH CHECK (
    -- Self-join via invite link
    user_id = auth.uid()
    OR
    -- Admin adding another user
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- Admins can change roles; users can remove themselves (self-leave).
CREATE POLICY "group_members: admins or self can update/delete"
  ON group_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "group_members: admins can update role"
  ON group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- ─── pings ───────────────────────────────────────────────────
CREATE POLICY "pings: group members can read"
  ON pings FOR SELECT
  USING (is_group_member(group_id));

CREATE POLICY "pings: group members can create"
  ON pings FOR INSERT
  WITH CHECK (is_group_member(group_id) AND created_by = auth.uid());

-- Creator or group admin can update a ping (e.g. status, proposed_time).
CREATE POLICY "pings: creator or admin can update"
  ON pings FOR UPDATE
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = pings.group_id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── rsvps ───────────────────────────────────────────────────
CREATE POLICY "rsvps: group members can read"
  ON rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pings p
      WHERE p.id = ping_id AND is_group_member(p.group_id)
    )
  );

-- Users can only upsert their own RSVP.
CREATE POLICY "rsvps: own row insert/update"
  ON rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "rsvps: own row update"
  ON rsvps FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── places ──────────────────────────────────────────────────
CREATE POLICY "places: group members can read"
  ON places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pings p
      WHERE p.id = ping_id AND is_group_member(p.group_id)
    )
  );

-- Any "in" RSVP can suggest a place.
CREATE POLICY "places: in-rsvp members can insert"
  ON places FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rsvps r
      JOIN pings p ON p.id = r.ping_id
      WHERE r.ping_id = places.ping_id
        AND r.user_id = auth.uid()
        AND r.status = 'in'
    )
  );

-- Places are immutable once created (no UPDATE or DELETE for users).

-- ─── votes ───────────────────────────────────────────────────
CREATE POLICY "votes: group members can read"
  ON votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pings p
      WHERE p.id = ping_id AND is_group_member(p.group_id)
    )
  );

-- Users can only insert their own vote (UNIQUE constraint prevents duplication;
-- use upsert to change vote).
CREATE POLICY "votes: own row insert"
  ON votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rsvps r
      WHERE r.ping_id = votes.ping_id AND r.user_id = auth.uid() AND r.status = 'in'
    )
  );

CREATE POLICY "votes: own row update (change vote)"
  ON votes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── saved_places ────────────────────────────────────────────
CREATE POLICY "saved_places: own rows"
  ON saved_places FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
