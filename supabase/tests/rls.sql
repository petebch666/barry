-- pgTAP RLS tests for Barry
-- Run with: npx supabase test db
-- Requires: local Supabase stack running (npx supabase start)

BEGIN;
SELECT plan(42);

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

SELECT * FROM finish();
ROLLBACK;
