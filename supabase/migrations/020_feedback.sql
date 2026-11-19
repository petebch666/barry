-- Beta feedback from the in-app form and the post-meetup prompt. Testers can
-- read only their own rows; the developer reads them all with the service
-- role or the SQL editor. Rows go with the account (personal data).
CREATE TABLE feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('general', 'ping_outcome')),
  rating      TEXT CHECK (rating IN ('up', 'down')),
  message     TEXT CHECK (char_length(message) <= 1000),
  ping_id     UUID REFERENCES pings(id) ON DELETE SET NULL,
  app_version TEXT CHECK (char_length(app_version) <= 50),
  platform    TEXT CHECK (platform IN ('ios', 'android', 'web')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (rating IS NOT NULL OR char_length(btrim(message)) > 0),
  CHECK (kind <> 'ping_outcome' OR (ping_id IS NOT NULL AND rating IS NOT NULL))
);

-- One outcome rating per person per ping; general feedback is unlimited.
CREATE UNIQUE INDEX feedback_one_outcome_per_ping
  ON feedback (user_id, ping_id) WHERE kind = 'ping_outcome';

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback: insert own, about own groups' pings"
  ON feedback FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      ping_id IS NULL
      OR EXISTS (SELECT 1 FROM pings p WHERE p.id = feedback.ping_id AND is_group_member(p.group_id))
    )
  );

CREATE POLICY "feedback: read own"
  ON feedback FOR SELECT
  USING (user_id = auth.uid());

-- Same function as 018 plus a 'feedback' key; CREATE OR REPLACE keeps its grants.
CREATE OR REPLACE FUNCTION export_my_data()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'exported_at', NOW(),
    'account', jsonb_build_object('id', auth.uid(), 'email', auth.jwt() ->> 'email'),
    'profile', (
      SELECT jsonb_build_object(
        'display_name', p.display_name, 'avatar_url', p.avatar_url,
        'created_at', p.created_at, 'updated_at', p.updated_at)
      FROM profiles p WHERE p.id = auth.uid()
    ),
    'groups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'group', g.name, 'role', gm.role, 'joined_at', gm.joined_at,
        'created_by_you', g.created_by = auth.uid()) ORDER BY gm.joined_at)
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = auth.uid()
    ), '[]'::jsonb),
    'pings_sent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'group', g.name, 'message', pi.message, 'proposed_time', pi.proposed_time,
        'status', pi.status, 'created_at', pi.created_at) ORDER BY pi.created_at)
      FROM pings pi JOIN groups g ON g.id = pi.group_id
      WHERE pi.created_by = auth.uid()
    ), '[]'::jsonb),
    'rsvps', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ping', pi.message, 'status', r.status,
        'latitude', r.latitude, 'longitude', r.longitude,
        'location_updated_at', r.location_updated_at, 'updated_at', r.updated_at)
        ORDER BY r.updated_at)
      FROM rsvps r JOIN pings pi ON pi.id = r.ping_id
      WHERE r.user_id = auth.uid()
    ), '[]'::jsonb),
    'venues_suggested', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ping', pi.message, 'name', pl.name, 'address', pl.address,
        'created_at', pl.created_at) ORDER BY pl.created_at)
      FROM places pl JOIN pings pi ON pi.id = pl.ping_id
      WHERE pl.suggested_by = auth.uid()
    ), '[]'::jsonb),
    'votes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ping', pi.message, 'venue', pl.name, 'created_at', v.created_at)
        ORDER BY v.created_at)
      FROM votes v
      JOIN pings pi ON pi.id = v.ping_id
      JOIN places pl ON pl.id = v.place_id
      WHERE v.user_id = auth.uid()
    ), '[]'::jsonb),
    'saved_places', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', sp.name, 'address', sp.address, 'category', sp.category,
        'latitude', sp.latitude, 'longitude', sp.longitude,
        'created_at', sp.created_at) ORDER BY sp.created_at)
      FROM saved_places sp WHERE sp.user_id = auth.uid()
    ), '[]'::jsonb),
    'place_ratings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'place', sp.name, 'rating', pr.rating,
        'created_at', pr.created_at, 'updated_at', pr.updated_at)
        ORDER BY pr.created_at)
      FROM place_ratings pr JOIN saved_places sp ON sp.id = pr.place_id
      WHERE pr.user_id = auth.uid()
    ), '[]'::jsonb),
    'push_tokens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'platform', pt.platform, 'updated_at', pt.updated_at))
      FROM push_tokens pt WHERE pt.user_id = auth.uid()
    ), '[]'::jsonb),
    'feedback', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'kind', f.kind, 'rating', f.rating, 'message', f.message,
        'app_version', f.app_version, 'platform', f.platform,
        'created_at', f.created_at) ORDER BY f.created_at)
      FROM feedback f WHERE f.user_id = auth.uid()
    ), '[]'::jsonb)
  )
$$;
