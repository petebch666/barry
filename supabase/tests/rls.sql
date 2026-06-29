-- pgTAP RLS tests for Barry
-- Run with: npx supabase test db
-- Requires: local Supabase stack running (npx supabase start)

BEGIN;
SELECT plan(14);

-- ─── Helpers ─────────────────────────────────────────────────

-- Create test users directly in auth.users (bypasses normal signup)
SELECT tests.create_supabase_user('alice', 'alice@test.com');
SELECT tests.create_supabase_user('bob',   'bob@test.com');

-- Seed: alice creates a group, both are members
DO $$
DECLARE
  alice_id UUID := tests.get_supabase_uid('alice');
  bob_id   UUID := tests.get_supabase_uid('bob');
  gid      UUID := gen_random_uuid();
  pid      UUID := gen_random_uuid();
BEGIN
  -- Profile rows (normally created by trigger, but tests bypass it)
  INSERT INTO profiles (id, display_name) VALUES (alice_id, 'Alice'), (bob_id, 'Bob')
  ON CONFLICT DO NOTHING;

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
     SELECT p.id, tests.get_supabase_uid('charlie'), 'in'
     FROM pings p WHERE p.message = 'Drinks tonight?' $$,
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

SELECT throws_ok(
  $$ UPDATE profiles SET display_name = 'Hacked' WHERE id = tests.get_supabase_uid('bob') $$,
  NULL,
  'user cannot update another profile'
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
     FROM groups g WHERE g.invite_code = 'TEST1234' $$,
  'user can self-join a group via invite code'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM groups WHERE invite_code = 'TEST1234' $$,
  ARRAY[1],
  'charlie can now read the group after joining'
);

SELECT * FROM finish();
ROLLBACK;
