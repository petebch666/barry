-- GDPR access and portability: everything stored about the caller, as JSON.
-- SECURITY DEFINER because RLS hides the caller's own pings and RSVPs in groups
-- they have left, and those are still their data. Every row is therefore
-- filtered on auth.uid() by hand; other members' rows never appear, only the
-- names of groups, pings and venues as context.
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
    ), '[]'::jsonb)
  )
$$;

-- Supabase grants EXECUTE to anon by default; revoking PUBLIC alone keeps it.
REVOKE ALL ON FUNCTION export_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION export_my_data() TO authenticated;
