-- Hardening for 013_places_sharing_and_ratings.sql (already applied, so
-- fixed forward here rather than edited in place).

-- SECURITY DEFINER without a pinned search_path lets a caller shadow
-- group_members with an object earlier on their path. Every other definer
-- function since 003 pins it; this one was missed.
ALTER FUNCTION shares_group_with(UUID) SET search_path = public;

-- The update policy only checked user_id, so a user could repoint their own
-- rating's place_id at a place they cannot see — something the insert policy
-- forbids. Apply the same visibility check on the new row.
DROP POLICY "place_ratings: own row update" ON place_ratings;

CREATE POLICY "place_ratings: own row update if place visible"
  ON place_ratings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM saved_places sp
      WHERE sp.id = place_id
        AND (sp.user_id = auth.uid() OR shares_group_with(sp.user_id))
    )
  );
