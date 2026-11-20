-- pgTAP RLS tests for Barry
-- Run with: npx supabase test db
-- Requires: local Supabase stack running (npx supabase start)

BEGIN;
SELECT plan(97);

-- ─── Helpers ─────────────────────────────────────────────────

-- Create test users directly in auth.users (bypasses normal signup)
SELECT tests.create_supabase_user('alice', 'alice@test.com');
SELECT tests.create_supabase_user('bob',   'bob@test.com');

-- Seed: alice creates a group, both are members
DO $$
DECLARE
  alice_id UUID := tests.get_supabase_uid('alice');
  bob_id   UUID := tests.get_supabase_uid('bob');
  gid      UUID := 'aaaaaaaa-0000-0000-0000-000000000001';
  pid      UUID := 'bbbbbbbb-0000-0000-0000-000000000001';
BEGIN
  -- Profile rows (normally created by trigger, but tests bypass it)
  INSERT INTO profiles (id, display_name) VALUES (alice_id, 'Alice'), (bob_id, 'Bob')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO groups (id, name, created_by, invite_code)
  VALUES (gid, 'Test Group', alice_id, 'TEST1234');

  INSERT INTO group_members (group_id, user_id, role)
  VALUES (gid, alice_id, 'admin'), (gid, bob_id, 'member');

  INSERT INTO pings (id, group_id, created_by, message)
  VALUES (pid, gid, alice_id, 'Drinks tonight?');
END;
$$;

-- ─── Test: non-member cannot read pings ──────────────────────
SELECT tests.authenticate_as('bob');

-- Bob is a member, so he CAN read
SELECT results_eq(
  $$ SELECT count(*)::int FROM pings WHERE message = 'Drinks tonight?' $$,
  ARRAY[1],
  'group member can read pings'
);

-- Authenticate as a random user (not a member of any group)
SELECT tests.create_supabase_user('charlie', 'charlie@test.com');
SELECT tests.authenticate_as_service_role();
INSERT INTO profiles (id, display_name)
VALUES (tests.get_supabase_uid('charlie'), 'Charlie')
ON CONFLICT DO NOTHING;

SELECT tests.authenticate_as('charlie');

SELECT results_eq(
  $$ SELECT count(*)::int FROM pings $$,
  ARRAY[0],
  'non-member cannot read any pings'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM groups $$,
  ARRAY[0],
  'non-member cannot read any groups'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM group_members $$,
  ARRAY[0],
  'non-member cannot read any group_members'
);

-- ─── Test: user can only read their own push_tokens ──────────
SELECT tests.authenticate_as('alice');

INSERT INTO push_tokens (user_id, token, platform)
VALUES (tests.get_supabase_uid('alice'), 'ExpoToken[alice_device]', 'ios');

SELECT tests.authenticate_as('charlie');

SELECT results_eq(
  $$ SELECT count(*)::int FROM push_tokens $$,
  ARRAY[0],
  'user cannot read others push_tokens'
);

-- ─── Test: user can only upsert their own RSVP ───────────────
SELECT tests.authenticate_as('bob');

-- Bob RSVPs to Alice's ping — should succeed
INSERT INTO rsvps (ping_id, user_id, status)
SELECT p.id, tests.get_supabase_uid('bob'), 'in'
FROM pings p WHERE p.message = 'Drinks tonight?';

SELECT results_eq(
  $$ SELECT count(*)::int FROM rsvps WHERE user_id = tests.get_supabase_uid('bob') $$,
  ARRAY[1],
  'member can insert their own RSVP'
);

-- Charlie (non-member) cannot insert an RSVP
SELECT tests.authenticate_as('charlie');

SELECT throws_ok(
  $$ INSERT INTO rsvps (ping_id, user_id, status)
     VALUES ('bbbbbbbb-0000-0000-0000-000000000001', tests.get_supabase_uid('charlie'), 'in') $$,
  'new row violates row-level security policy for table "rsvps"',
  'non-member cannot insert RSVP'
);

-- ─── Test: vote UNIQUE constraint prevents double-voting ──────
SELECT tests.authenticate_as('bob');

-- Add a place first (need to be "in" which we are from above)
INSERT INTO places (ping_id, name, latitude, longitude, source)
SELECT p.id, 'Le Bar', 48.8566, 2.3522, 'manual'
FROM pings p WHERE p.message = 'Drinks tonight?';

-- First vote
INSERT INTO votes (ping_id, place_id, user_id)
SELECT p.id, pl.id, tests.get_supabase_uid('bob')
FROM pings p, places pl
WHERE p.message = 'Drinks tonight?' AND pl.name = 'Le Bar';

-- Attempt to vote again for a different place (should fail due to UNIQUE)
INSERT INTO places (ping_id, name, latitude, longitude, source)
SELECT p.id, 'Le Restaurant', 48.86, 2.35, 'manual'
FROM pings p WHERE p.message = 'Drinks tonight?';

SELECT throws_ok(
  $$ INSERT INTO votes (ping_id, place_id, user_id)
     SELECT p.id, pl.id, tests.get_supabase_uid('bob')
     FROM pings p, places pl
     WHERE p.message = 'Drinks tonight?' AND pl.name = 'Le Restaurant' $$,
  'duplicate key value violates unique constraint "votes_ping_id_user_id_key"',
  'UNIQUE constraint prevents a second vote on same ping'
);

-- But upsert (UPDATE) to change vote should work
SELECT lives_ok(
  $$ INSERT INTO votes (ping_id, place_id, user_id)
     SELECT p.id, pl.id, tests.get_supabase_uid('bob')
     FROM pings p, places pl
     WHERE p.message = 'Drinks tonight?' AND pl.name = 'Le Restaurant'
     ON CONFLICT (ping_id, user_id) DO UPDATE SET place_id = EXCLUDED.place_id $$,
  'user can change their vote via upsert'
);

-- ─── Test: own profile update only ───────────────────────────
SELECT tests.authenticate_as('alice');

SELECT lives_ok(
  $$ UPDATE profiles SET display_name = 'Alice Updated' WHERE id = tests.get_supabase_uid('alice') $$,
  'user can update their own profile'
);

SELECT lives_ok(
  $$ UPDATE profiles SET display_name = 'Hacked' WHERE id = tests.get_supabase_uid('bob') $$,
  'updating another profile is filtered by RLS rather than raising'
);

-- After the update, Bob's name should still be 'Bob'
SELECT tests.authenticate_as('bob');
SELECT results_eq(
  $$ SELECT display_name FROM profiles WHERE id = tests.get_supabase_uid('bob') $$,
  ARRAY['Bob'],
  'Bob profile unchanged after Alice tried to modify it'
);

-- ─── Test: invite self-join ───────────────────────────────────
SELECT tests.authenticate_as('charlie');

-- Charlie uses the invite code to join the group
SELECT lives_ok(
  $$ INSERT INTO group_members (group_id, user_id, role)
     SELECT g.id, tests.get_supabase_uid('charlie'), 'member'
     FROM lookup_group_by_invite_code('TEST1234') g $$,
  'user can self-join a group via invite code'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM groups WHERE invite_code = 'TEST1234' $$,
  ARRAY[1],
  'charlie can now read the group after joining'
);

-- ─── Test: 016 membership policies ──────────────────────────
-- Dave is in no group with Alice/Bob/Charlie; he creates his own group, which
-- before 016 made him an "admin of any group" and so of every group.
SELECT tests.create_supabase_user('dave', 'dave@test.com');
SELECT tests.authenticate_as('dave');

SELECT throws_ok(
  $$ INSERT INTO group_members (group_id, user_id, role)
     VALUES ('aaaaaaaa-0000-0000-0000-000000000001', tests.get_supabase_uid('dave'), 'admin') $$,
  'new row violates row-level security policy for table "group_members"',
  'cannot self-join a group as admin'
);

INSERT INTO groups (id, name, created_by, invite_code)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'Dave Group', tests.get_supabase_uid('dave'), 'DAVE1234');

SELECT lives_ok(
  $$ INSERT INTO group_members (group_id, user_id, role)
     VALUES ('aaaaaaaa-0000-0000-0000-000000000002', tests.get_supabase_uid('dave'), 'admin') $$,
  'group creator can add themselves as admin'
);

INSERT INTO pings (id, group_id, created_by, message)
VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', tests.get_supabase_uid('dave'), 'Dave ping');

-- Unfiltered writes: before 016 these hit every group's memberships.
DELETE FROM group_members WHERE user_id <> tests.get_supabase_uid('dave');
UPDATE group_members SET role = 'admin' WHERE user_id <> tests.get_supabase_uid('dave');

SELECT tests.authenticate_as('alice');
SELECT results_eq(
  $$ SELECT count(*)::int FROM group_members WHERE group_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  ARRAY[3],
  'admin of another group cannot delete this group''s members'
);

SELECT results_eq(
  $$ SELECT role FROM group_members
     WHERE group_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND user_id = tests.get_supabase_uid('bob') $$,
  ARRAY['member'],
  'admin of another group cannot change this group''s roles'
);

UPDATE group_members SET role = 'admin'
WHERE group_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND user_id = tests.get_supabase_uid('charlie');
SELECT results_eq(
  $$ SELECT role FROM group_members
     WHERE group_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND user_id = tests.get_supabase_uid('charlie') $$,
  ARRAY['admin'],
  'group admin can change roles in their own group'
);
UPDATE group_members SET role = 'member'
WHERE group_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND user_id = tests.get_supabase_uid('charlie');

SELECT throws_ok(
  $$ UPDATE pings SET group_id = 'aaaaaaaa-0000-0000-0000-000000000002'
     WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'new row violates row-level security policy for table "pings"',
  'cannot move a ping into a group you are not in'
);

SELECT tests.authenticate_as('bob');
SELECT throws_ok(
  $$ UPDATE rsvps SET ping_id = 'bbbbbbbb-0000-0000-0000-000000000002'
     WHERE ping_id = 'bbbbbbbb-0000-0000-0000-000000000001' AND user_id = tests.get_supabase_uid('bob') $$,
  'new row violates row-level security policy for table "rsvps"',
  'cannot move an RSVP onto a ping outside your groups'
);

SELECT throws_ok(
  $$ UPDATE votes SET ping_id = 'bbbbbbbb-0000-0000-0000-000000000002'
     WHERE ping_id = 'bbbbbbbb-0000-0000-0000-000000000001' AND user_id = tests.get_supabase_uid('bob') $$,
  'new row violates row-level security policy for table "votes"',
  'cannot move a vote onto a ping you are not in'
);

SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=public'] FROM pg_proc WHERE proname = 'is_group_admin'),
  'is_group_admin pins search_path'
);

-- ─── Test: start_ping_voting RPC (vote timer feature) ─────────
-- Two more 'open' pings for these tests, since pid above still needs to
-- stay untouched for the tests above to have run against it.
SELECT tests.authenticate_as_service_role();
INSERT INTO pings (id, group_id, created_by, message, vote_timer_minutes)
SELECT gen_random_uuid(), g.id, tests.get_supabase_uid('alice'), 'No-timer ping', NULL
FROM groups g WHERE g.invite_code = 'TEST1234';

INSERT INTO pings (id, group_id, created_by, message, vote_timer_minutes)
SELECT gen_random_uuid(), g.id, tests.get_supabase_uid('alice'), 'Timed ping', 30
FROM groups g WHERE g.invite_code = 'TEST1234';

INSERT INTO pings (id, group_id, created_by, message, vote_timer_minutes)
SELECT gen_random_uuid(), g.id, tests.get_supabase_uid('alice'), 'RLS-guarded ping', NULL
FROM groups g WHERE g.invite_code = 'TEST1234';

SELECT tests.authenticate_as('alice');

-- No timer: voting_deadline stays null after starting voting.
SELECT results_eq(
  $$ SELECT status, voting_deadline IS NULL
     FROM start_ping_voting(
       (SELECT id FROM pings WHERE message = 'No-timer ping')
     ) $$,
  $$ VALUES ('voting'::text, true) $$,
  'start_ping_voting with no timer leaves voting_deadline null'
);

-- Timer set: voting_deadline is stamped ~30 minutes out.
SELECT results_eq(
  $$ SELECT status, voting_deadline BETWEEN NOW() + INTERVAL '29 minutes' AND NOW() + INTERVAL '31 minutes'
     FROM start_ping_voting(
       (SELECT id FROM pings WHERE message = 'Timed ping')
     ) $$,
  $$ VALUES ('voting'::text, true) $$,
  'start_ping_voting with a 30-minute timer stamps voting_deadline ~30 minutes out'
);

-- Idempotency: calling it again on an already-'voting' ping is a no-op.
SELECT results_eq(
  $$ SELECT id IS NULL FROM start_ping_voting(
       (SELECT id FROM pings WHERE message = 'No-timer ping')
     ) $$,
  ARRAY[true],
  'start_ping_voting is a no-op once the ping is no longer open'
);

-- Bob is a group member but neither the creator nor an admin of this ping —
-- the "creator or admin can update" policy's USING clause silently filters
-- the UPDATE inside the function to zero rows (no error, just no effect).
SELECT tests.authenticate_as('bob');

SELECT results_eq(
  $$ SELECT id IS NULL FROM start_ping_voting(
       (SELECT id FROM pings WHERE message = 'RLS-guarded ping')
     ) $$,
  ARRAY[true],
  'non-creator, non-admin member cannot start voting on someone else''s ping'
);

SELECT tests.authenticate_as('alice');
SELECT results_eq(
  $$ SELECT status FROM pings WHERE message = 'RLS-guarded ping' $$,
  ARRAY['open'],
  'RLS-guarded ping is still open after bob''s blocked attempt'
);

-- ─── Test: request_more_places RPC ("Find more places" feature) ───────
INSERT INTO pings (id, group_id, created_by, message)
SELECT gen_random_uuid(), g.id, tests.get_supabase_uid('alice'), 'Batch test ping'
FROM groups g WHERE g.invite_code = 'TEST1234';

SELECT tests.authenticate_as('alice');
SELECT status FROM start_ping_voting((SELECT id FROM pings WHERE message = 'Batch test ping'));

SELECT tests.authenticate_as('bob');
INSERT INTO rsvps (ping_id, user_id, status)
SELECT p.id, tests.get_supabase_uid('bob'), 'in'
FROM pings p WHERE p.message = 'Batch test ping';

-- An "in" member (not the creator/admin) can request more places — bumps places_batch 1 -> 2
SELECT results_eq(
  $$ SELECT places_batch FROM request_more_places(
       (SELECT id FROM pings WHERE message = 'Batch test ping')
     ) $$,
  ARRAY[2],
  'an "in" member (not creator/admin) can request more places'
);

-- Charlie never RSVP'd to this ping — cannot request more places
SELECT tests.authenticate_as('charlie');
SELECT throws_ok(
  $$ SELECT * FROM request_more_places(
       (SELECT id FROM pings WHERE message = 'Batch test ping')
     ) $$,
  'Only "in" members can request more places',
  'a non-"in" member cannot request more places'
);

-- Cap at 3: bob bumps to 3, then a further attempt is a no-op
SELECT tests.authenticate_as('bob');
SELECT places_batch FROM request_more_places((SELECT id FROM pings WHERE message = 'Batch test ping'));

SELECT results_eq(
  $$ SELECT id IS NULL FROM request_more_places(
       (SELECT id FROM pings WHERE message = 'Batch test ping')
     ) $$,
  ARRAY[true],
  'request_more_places is capped at 3 batches'
);

-- ─── Test: saved_places sharing + place_ratings (Places tab feature) ──
-- Alice and Bob share "Test Group" (seeded at the top). Charlie joined it
-- via the invite test above, so the outsider here is Dave, whose only group
-- is his own.
SELECT tests.authenticate_as_service_role();

INSERT INTO saved_places (id, user_id, name, latitude, longitude)
VALUES
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('alice'), 'Le Comptoir', 48.8566, 2.3522),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('dave'),  'Chez Dave',   48.8600, 2.3400);

SELECT tests.authenticate_as('bob');
SELECT results_eq(
  $$ SELECT count(*)::int FROM saved_places WHERE name = 'Le Comptoir' $$,
  ARRAY[1],
  'group member can read a shared-group place'
);

SELECT tests.authenticate_as('dave');
SELECT results_eq(
  $$ SELECT count(*)::int FROM saved_places WHERE name = 'Le Comptoir' $$,
  ARRAY[0],
  'non-group member cannot read another user''s place'
);

SELECT tests.authenticate_as('bob');
SELECT lives_ok(
  $$ INSERT INTO place_ratings (place_id, user_id, rating)
     VALUES ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('bob'), 'loved_it') $$,
  'group member can rate a place they can see'
);

SELECT tests.authenticate_as('dave');
SELECT throws_ok(
  $$ INSERT INTO place_ratings (place_id, user_id, rating)
     VALUES ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('dave'), 'loved_it') $$,
  NULL,
  'non-group member cannot rate a place they cannot see'
);

-- 015: the update policy re-checks visibility of the new place_id.
SELECT tests.authenticate_as('bob');
SELECT throws_ok(
  $$ UPDATE place_ratings SET place_id = '22222222-2222-2222-2222-222222222222'
     WHERE user_id = tests.get_supabase_uid('bob') $$,
  NULL,
  'cannot repoint own rating at a place you cannot see'
);

SELECT lives_ok(
  $$ UPDATE place_ratings SET rating = 'want_to_try'
     WHERE user_id = tests.get_supabase_uid('bob') $$,
  'can still change own rating on a visible place'
);

SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=public'] FROM pg_proc WHERE proname = 'shares_group_with'),
  'shares_group_with pins search_path'
);

-- Bob attempts to modify Alice's place directly — still owner-only for
-- writes; the UPDATE's USING clause silently matches zero rows.
SELECT tests.authenticate_as('bob');
UPDATE saved_places SET name = 'Hacked' WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT tests.authenticate_as('alice');
SELECT results_eq(
  $$ SELECT name FROM saved_places WHERE id = '11111111-1111-1111-1111-111111111111' $$,
  ARRAY['Le Comptoir'],
  'non-owner update of a shared place is silently blocked by RLS'
);

-- Alice adds her own rating; both ratings become readable by any group member.
INSERT INTO place_ratings (place_id, user_id, rating)
VALUES ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('alice'), 'it_was_fine');

SELECT tests.authenticate_as('bob');
SELECT results_eq(
  $$ SELECT count(*)::int FROM place_ratings WHERE place_id = '11111111-1111-1111-1111-111111111111' $$,
  ARRAY[2],
  'both ratings on a shared place are readable by any group member'
);

-- Owner deletes their own place — succeeds, cascades to place_ratings.
SELECT tests.authenticate_as('alice');
SELECT lives_ok(
  $$ DELETE FROM saved_places WHERE id = '11111111-1111-1111-1111-111111111111' $$,
  'owner can delete their own place'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM place_ratings WHERE place_id = '11111111-1111-1111-1111-111111111111' $$,
  ARRAY[0],
  'deleting a place cascades to its ratings'
);

-- ─── Test: account deletion keeps shared data (017) ─────────
-- Erin created a group, a ping and a venue. Frank joined before Gina.
-- Hank is alone in his own group.
SELECT tests.create_supabase_user('erin',  'erin@test.com');
SELECT tests.create_supabase_user('frank', 'frank@test.com');
SELECT tests.create_supabase_user('gina',  'gina@test.com');
SELECT tests.create_supabase_user('hank',  'hank@test.com');
SELECT tests.authenticate_as_service_role();
DO $$
DECLARE
  erin_id  UUID := tests.get_supabase_uid('erin');
  frank_id UUID := tests.get_supabase_uid('frank');
  gina_id  UUID := tests.get_supabase_uid('gina');
  hank_id  UUID := tests.get_supabase_uid('hank');
BEGIN
  INSERT INTO groups (id, name, created_by, invite_code) VALUES
    ('cccccccc-0000-0000-0000-000000000001', 'Erin Group', erin_id, 'ERIN1234'),
    ('cccccccc-0000-0000-0000-000000000002', 'Hank Group', hank_id, 'HANK1234');
  INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES
    ('cccccccc-0000-0000-0000-000000000001', erin_id,  'admin',  NOW() - INTERVAL '3 days'),
    ('cccccccc-0000-0000-0000-000000000001', frank_id, 'member', NOW() - INTERVAL '2 days'),
    ('cccccccc-0000-0000-0000-000000000001', gina_id,  'member', NOW() - INTERVAL '1 day'),
    ('cccccccc-0000-0000-0000-000000000002', hank_id,  'admin',  NOW());
  INSERT INTO pings (id, group_id, created_by, message)
  VALUES ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', erin_id, 'Erin ping');
  INSERT INTO places (id, ping_id, name, latitude, longitude, source, suggested_by)
  VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
          'Erin bar', 48.86, 2.35, 'manual', erin_id);
END;
$$;

SELECT tests.authenticate_as('erin');
SELECT lives_ok(
  $$ SELECT delete_user() $$,
  'a user who created a group, a ping and a venue can delete their account'
);

SELECT tests.authenticate_as_service_role();
SELECT results_eq(
  $$ SELECT created_by IS NULL FROM groups WHERE id = 'cccccccc-0000-0000-0000-000000000001' $$,
  ARRAY[true],
  'their group stays, with no creator'
);
SELECT results_eq(
  $$ SELECT created_by IS NULL FROM pings WHERE id = 'dddddddd-0000-0000-0000-000000000001' $$,
  ARRAY[true],
  'their ping stays, with no creator'
);
SELECT results_eq(
  $$ SELECT suggested_by IS NULL FROM places WHERE id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  ARRAY[true],
  'their venue stays, with no suggester'
);
SELECT results_eq(
  $$ SELECT role FROM group_members
     WHERE group_id = 'cccccccc-0000-0000-0000-000000000001'
     ORDER BY joined_at $$,
  ARRAY['admin', 'member'],
  'the longest-standing remaining member becomes admin'
);

-- Leaving as the only admin hands the role on too.
SELECT tests.authenticate_as('frank');
DELETE FROM group_members
WHERE group_id = 'cccccccc-0000-0000-0000-000000000001' AND user_id = auth.uid();
SELECT tests.authenticate_as_service_role();
SELECT results_eq(
  $$ SELECT role FROM group_members WHERE group_id = 'cccccccc-0000-0000-0000-000000000001' $$,
  ARRAY['admin'],
  'the only admin leaving promotes the next member'
);

SELECT tests.authenticate_as('hank');
SELECT lives_ok($$ SELECT delete_user() $$, 'the only member of a group can delete their account');
SELECT tests.authenticate_as_service_role();
SELECT is_empty(
  $$ SELECT 1 FROM groups WHERE id = 'cccccccc-0000-0000-0000-000000000002' $$,
  'a group left with no members is removed'
);

-- ─── Test: export_my_data (018) ─────────────────────────────
-- Bob has an RSVP and a vote in Test Group; Alice and Charlie have rows too.
SELECT tests.authenticate_as('bob');
SELECT results_eq(
  $$ SELECT (export_my_data() -> 'account' ->> 'id')::uuid $$,
  ARRAY[tests.get_supabase_uid('bob')],
  'the export is about the caller'
);
SELECT results_eq(
  $$ SELECT export_my_data() -> 'profile' ->> 'display_name' $$,
  ARRAY['Bob'],
  'the export includes the caller''s profile'
);
SELECT ok(
  (SELECT jsonb_array_length(export_my_data() -> 'rsvps') >= 1),
  'the export includes the caller''s RSVPs'
);
SELECT results_eq(
  $$ SELECT count(*)::int FROM rsvps WHERE user_id = auth.uid() $$,
  $$ SELECT jsonb_array_length(export_my_data() -> 'rsvps') $$,
  'the export has exactly the caller''s RSVPs, none of other members'
);
SELECT is(
  jsonb_array_length(export_my_data() -> 'pings_sent'),
  0,
  'pings sent by other members are not exported'
);
SELECT tests.clear_authentication();
SELECT throws_ok(
  $$ SELECT export_my_data() $$,
  '42501',
  NULL,
  'anonymous callers cannot export'
);

-- ─── Test: anon function access (019) ───────────────────────
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname NOT IN ('is_group_member', 'is_group_admin', 'shares_group_with')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon can execute no SECURITY DEFINER function except the RLS helpers'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'cancel_expired_pings()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'nullify_terminal_ping_locations()', 'EXECUTE'),
  'signed-in users cannot run the scheduled jobs'
);
SELECT ok(
  has_function_privilege('authenticated', 'lookup_group_by_invite_code(text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'delete_user()', 'EXECUTE'),
  'signed-in users keep the functions the app calls'
);
SELECT ok(
  has_function_privilege('anon', 'is_group_member(uuid)', 'EXECUTE'),
  'RLS helpers stay callable so anon queries return nothing instead of erroring'
);

-- ─── Test: feedback (020) ───────────────────────────────────
SELECT tests.authenticate_as('bob');
SELECT lives_ok(
  $$ INSERT INTO feedback (kind, message, platform) VALUES ('general', 'Love it', 'web') $$,
  'a member can send general feedback'
);
SELECT lives_ok(
  $$ INSERT INTO feedback (kind, rating, ping_id) VALUES ('ping_outcome', 'up', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  'a member can rate a ping in their group'
);
SELECT throws_ok(
  $$ INSERT INTO feedback (kind, rating, ping_id) VALUES ('ping_outcome', 'down', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  '23505', NULL,
  'one outcome rating per person per ping'
);
SELECT throws_ok(
  $$ INSERT INTO feedback (kind, ping_id) VALUES ('ping_outcome', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  '23514', NULL,
  'an outcome rating needs a rating'
);
SELECT throws_ok(
  $$ INSERT INTO feedback (kind, message) VALUES ('general', '   ') $$,
  '23514', NULL,
  'empty feedback is rejected'
);
SELECT throws_ok(
  format($$ INSERT INTO feedback (user_id, kind, message) VALUES (%L, 'general', 'x') $$, tests.get_supabase_uid('alice')),
  '42501', NULL,
  'feedback cannot be sent in someone else''s name'
);
SELECT results_eq(
  $$ SELECT jsonb_array_length(export_my_data() -> 'feedback') $$,
  ARRAY[2],
  'the export includes the caller''s feedback'
);

SELECT tests.authenticate_as('dave');
SELECT throws_ok(
  $$ INSERT INTO feedback (kind, rating, ping_id) VALUES ('ping_outcome', 'up', 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  '42501', NULL,
  'feedback cannot be attached to a ping outside your groups'
);

SELECT tests.authenticate_as('alice');
SELECT is_empty(
  $$ SELECT 1 FROM feedback WHERE user_id = tests.get_supabase_uid('bob') $$,
  'members cannot read each other''s feedback'
);

-- ─── Test: beta metrics (021) ───────────────────────────────
SELECT throws_ok(
  $$ SELECT * FROM beta.ping_funnel $$,
  '42501', NULL,
  'signed-in users cannot read the beta metrics'
);

SELECT tests.authenticate_as_service_role();
INSERT INTO pings (id, group_id, created_by, message)
VALUES ('bbbbbbbb-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001',
        tests.get_supabase_uid('alice'), 'Metrics ping');
INSERT INTO rsvps (ping_id, user_id, status, latitude, longitude)
VALUES ('bbbbbbbb-0000-0000-0000-000000000009', tests.get_supabase_uid('bob'), 'in', 48.86, 2.35);
UPDATE pings SET status = 'cancelled' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000009';
SELECT nullify_terminal_ping_locations();
SELECT results_eq(
  $$ SELECT decided_at IS NOT NULL FROM pings WHERE id = 'bbbbbbbb-0000-0000-0000-000000000009' $$,
  ARRAY[true],
  'a cancelled ping records when it was decided'
);
SELECT results_eq(
  $$ SELECT latitude IS NULL AND shared_location FROM rsvps
     WHERE ping_id = 'bbbbbbbb-0000-0000-0000-000000000009' $$,
  ARRAY[true],
  'the coordinates are erased but the fact a location was shared stays'
);

-- ─── Test: edge function triggers (022) ─────────────────────
-- Without Vault secrets the triggers skip (every test above ran that way).
SELECT tests.authenticate_as_service_role();
SELECT is_empty(
  $$ SELECT 1 FROM net.http_request_queue $$,
  'without Vault secrets, no edge function request is queued'
);

RESET ROLE;
SELECT vault.create_secret('https://example.test', 'project_url');
SELECT vault.create_secret('test-service-key', 'service_role_key');
SELECT tests.authenticate_as_service_role();

INSERT INTO pings (id, group_id, created_by, message)
VALUES ('bbbbbbbb-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001',
        tests.get_supabase_uid('alice'), 'Trigger ping');
SELECT results_eq(
  $$ SELECT url, headers ->> 'Authorization', (convert_from(body, 'UTF8')::jsonb) #>> '{record,id}'
     FROM net.http_request_queue ORDER BY id DESC LIMIT 1 $$,
  $$ VALUES ('https://example.test/functions/v1/notify-group-on-ping', 'Bearer test-service-key',
             'bbbbbbbb-0000-0000-0000-000000000010') $$,
  'a new ping calls notify-group-on-ping with the service key and the row'
);

DELETE FROM net.http_request_queue;
UPDATE pings SET status = 'voting' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000010';
SELECT bag_eq(
  $$ SELECT url FROM net.http_request_queue $$,
  $$ VALUES ('https://example.test/functions/v1/fetch-nearby-places'),
            ('https://example.test/functions/v1/notify-voting-started') $$,
  'voting starting fetches places and notifies'
);

DELETE FROM net.http_request_queue;
UPDATE pings SET places_batch = places_batch + 1 WHERE id = 'bbbbbbbb-0000-0000-0000-000000000010';
SELECT results_eq(
  $$ SELECT url FROM net.http_request_queue $$,
  $$ VALUES ('https://example.test/functions/v1/fetch-nearby-places') $$,
  'another round of places during voting fetches again but does not re-notify'
);

DELETE FROM net.http_request_queue;
INSERT INTO rsvps (ping_id, user_id, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000010', tests.get_supabase_uid('bob'), 'in');
INSERT INTO places (id, ping_id, name, latitude, longitude, source)
VALUES ('eeeeeeee-0000-0000-0000-000000000010', 'bbbbbbbb-0000-0000-0000-000000000010', 'Bar', 48.86, 2.35, 'manual');
INSERT INTO votes (ping_id, place_id, user_id)
VALUES ('bbbbbbbb-0000-0000-0000-000000000010', 'eeeeeeee-0000-0000-0000-000000000010', tests.get_supabase_uid('bob'));
SELECT bag_eq(
  $$ SELECT url FROM net.http_request_queue $$,
  $$ VALUES ('https://example.test/functions/v1/notify-pinger'),
            ('https://example.test/functions/v1/check-vote-majority') $$,
  'an answer tells the pinger (025), and a vote checks for a majority'
);

DELETE FROM net.http_request_queue;
UPDATE rsvps SET status = 'out'
WHERE ping_id = 'bbbbbbbb-0000-0000-0000-000000000010' AND user_id = tests.get_supabase_uid('bob');
SELECT bag_eq(
  $$ SELECT url, (convert_from(body, 'UTF8')::jsonb) #>> '{old_record,status}' FROM net.http_request_queue $$,
  $$ VALUES ('https://example.test/functions/v1/notify-rsvp-change', 'in'),
            ('https://example.test/functions/v1/notify-pinger', 'in'),
            ('https://example.test/functions/v1/check-vote-majority', 'in') $$,
  'dropping out recomputes the meeting point, tells the pinger and re-checks the majority (026)'
);
SELECT is_empty(
  $$ SELECT 1 FROM votes WHERE ping_id = 'bbbbbbbb-0000-0000-0000-000000000010'
       AND user_id = tests.get_supabase_uid('bob') $$,
  'dropping out removes the leaver''s vote (026)'
);

DELETE FROM net.http_request_queue;
UPDATE rsvps SET status = 'maybe'
WHERE ping_id = 'bbbbbbbb-0000-0000-0000-000000000010' AND user_id = tests.get_supabase_uid('bob');
SELECT results_eq(
  $$ SELECT url FROM net.http_request_queue $$,
  $$ VALUES ('https://example.test/functions/v1/notify-pinger') $$,
  'other answer changes only tell the pinger'
);

DELETE FROM net.http_request_queue;
UPDATE rsvps SET latitude = 48.87, longitude = 2.36
WHERE ping_id = 'bbbbbbbb-0000-0000-0000-000000000010' AND user_id = tests.get_supabase_uid('bob');
SELECT is_empty(
  $$ SELECT 1 FROM net.http_request_queue $$,
  'a location-only change tells nobody'
);

DELETE FROM net.http_request_queue;
UPDATE pings SET status = 'cancelled' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000010';
SELECT results_eq(
  $$ SELECT url FROM net.http_request_queue $$,
  $$ VALUES ('https://example.test/functions/v1/notify-ping-cancelled') $$,
  'cancelling a ping notifies, and does not fetch places'
);

DELETE FROM net.http_request_queue;
UPDATE pings SET message = 'Edited' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000010';
SELECT is_empty(
  $$ SELECT 1 FROM net.http_request_queue $$,
  'unrelated ping updates call nothing'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'call_edge_function()', 'EXECUTE'),
  'clients cannot call the trigger function'
);

-- ─── Test: admin accounts (023) ─────────────────────────────
RESET ROLE;
CREATE TEMP TABLE new_tester ON COMMIT DROP AS
  SELECT * FROM admin.create_user('  Ana.Tester@Example.org ', 'Ana');

SELECT results_eq(
  $$ SELECT email FROM new_tester $$,
  ARRAY['ana.tester@example.org'],
  'create_user normalises the email'
);
SELECT ok(
  (SELECT char_length(password) = 12 AND password ~ '^[a-km-np-zA-HJ-NP-Z2-9]+$' FROM new_tester),
  'create_user generates a 12-character password without look-alike characters'
);
SELECT ok(
  (SELECT u.email_confirmed_at IS NOT NULL AND u.encrypted_password = extensions.crypt(t.password, u.encrypted_password)
   FROM auth.users u JOIN new_tester t ON t.user_id = u.id),
  'the account is confirmed and signs in with the returned password'
);
SELECT results_eq(
  $$ SELECT p.display_name FROM profiles p JOIN new_tester t ON t.user_id = p.id $$,
  ARRAY['Ana'],
  'the profile gets the display name'
);
SELECT results_eq(
  $$ SELECT count(*)::int FROM auth.identities i JOIN new_tester t ON t.user_id = i.user_id WHERE i.provider = 'email' $$,
  ARRAY[1],
  'the account has an email identity, needed for password sign-in'
);
SELECT throws_ok(
  $$ SELECT * FROM admin.create_user('ana.tester@example.org', 'Ana again') $$,
  'P0001', 'an account already exists for ana.tester@example.org',
  'create_user refuses an existing email'
);
SELECT throws_ok(
  $$ SELECT * FROM admin.create_user('bea@example.org', 'Bea', 'short') $$,
  'P0001', 'password must be at least 8 characters',
  'create_user refuses a short password'
);
SELECT * FROM admin.set_password('ana.tester@example.org', 'a-new-password');
SELECT ok(
  (SELECT encrypted_password = extensions.crypt('a-new-password', encrypted_password)
   FROM auth.users WHERE email = 'ana.tester@example.org'),
  'set_password changes the password'
);
SELECT throws_ok(
  $$ SELECT * FROM admin.set_password('nobody@example.org') $$,
  'P0001', 'no account for nobody@example.org',
  'set_password refuses an unknown email'
);
SELECT ok(
  NOT has_schema_privilege('authenticated', 'admin', 'USAGE')
  AND NOT has_schema_privilege('anon', 'admin', 'USAGE')
  AND NOT has_schema_privilege('service_role', 'admin', 'USAGE'),
  'no client role can reach the admin schema'
);

-- ─── Test: server-side invite codes (024) ───────────────────
SELECT tests.authenticate_as('alice');
INSERT INTO groups (id, name, created_by)
VALUES ('aaaaaaaa-0000-0000-0000-000000000024', 'No code sent', auth.uid());
SELECT tests.authenticate_as_service_role();
SELECT ok(
  (SELECT invite_code ~ '^[0-9A-F]{8}$' FROM groups WHERE id = 'aaaaaaaa-0000-0000-0000-000000000024'),
  'a group created without an invite code gets an 8-character uppercase hex one'
);
SELECT is(
  (SELECT count(DISTINCT c) FROM (SELECT generate_invite_code() AS c FROM generate_series(1, 200)) s),
  200::bigint,
  'generated codes do not repeat'
);
SELECT ok(
  NOT has_function_privilege('anon', 'generate_invite_code()', 'EXECUTE'),
  'signed-out callers cannot generate codes'
);

SELECT * FROM finish();
ROLLBACK;
