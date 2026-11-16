-- Turns saved_places from a private per-user bookmark list into a
-- group-shared "Places" feed with lightweight ternary ratings.
--
-- Data model: saved_places rows stay independent per owner (no
-- cross-user venue dedup — that's a separate project). place_ratings
-- holds each group member's ternary opinion on a place, keyed
-- (place_id, user_id) — the same "many users opine on one row" shape
-- votes already uses for places. This is what makes "3 of your group
-- loved this" possible: anyone who can see a place can also rate it,
-- independent of who added it.

-- Mirrors is_group_member(gid) in 002_rls_policies.sql exactly —
-- SECURITY DEFINER bypasses RLS on group_members but only exposes a
-- boolean. "Do I share a group with this user?"
CREATE OR REPLACE FUNCTION shares_group_with(other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = other_user_id
  )
$$;

REVOKE ALL ON FUNCTION shares_group_with(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shares_group_with(UUID) TO authenticated;

CREATE TABLE place_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   UUID NOT NULL REFERENCES saved_places(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating     TEXT NOT NULL CHECK (rating IN ('loved_it', 'it_was_fine', 'not_for_me')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, user_id)
);

CREATE INDEX ON place_ratings (place_id);
CREATE INDEX ON place_ratings (user_id);

ALTER TABLE place_ratings ENABLE ROW LEVEL SECURITY;

-- Reuses the generic set_updated_at() trigger function from
-- 003_triggers.sql (already used by profiles/rsvps/push_tokens).
CREATE TRIGGER place_ratings_updated_at
  BEFORE UPDATE ON place_ratings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── saved_places: own-rows-only read → own OR shared-group read ─────
DROP POLICY "saved_places: own rows" ON saved_places;

CREATE POLICY "saved_places: own or shared-group can read"
  ON saved_places FOR SELECT
  USING (user_id = auth.uid() OR shares_group_with(user_id));

CREATE POLICY "saved_places: own rows insert"
  ON saved_places FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_places: own rows update"
  ON saved_places FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_places: own rows delete"
  ON saved_places FOR DELETE
  USING (user_id = auth.uid());

-- ─── place_ratings: readable by anyone who can see the place; ────────
-- writable only for your own rating, and only on a place visible to you.
CREATE POLICY "place_ratings: readable if place is visible"
  ON place_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM saved_places sp
      WHERE sp.id = place_id
        AND (sp.user_id = auth.uid() OR shares_group_with(sp.user_id))
    )
  );

CREATE POLICY "place_ratings: own row insert if place visible"
  ON place_ratings FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM saved_places sp
      WHERE sp.id = place_id
        AND (sp.user_id = auth.uid() OR shares_group_with(sp.user_id))
    )
  );

CREATE POLICY "place_ratings: own row update"
  ON place_ratings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "place_ratings: own row delete"
  ON place_ratings FOR DELETE
  USING (user_id = auth.uid());
