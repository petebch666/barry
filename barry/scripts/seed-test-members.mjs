/**
 * Dev-only seed script. Creates two test users and adds them to a group.
 *
 * Usage (from barry/):
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/seed-test-members.mjs <INVITE_CODE>
 *
 * The SUPABASE_SERVICE_ROLE_KEY must never be committed or added to any
 * EXPO_PUBLIC_* variable — pass it as an env var at runtime only.
 */

import { createClient } from '@supabase/supabase-js';

const INVITE_CODE = process.argv[2]?.toUpperCase();
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!INVITE_CODE) {
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/seed-test-members.mjs <INVITE_CODE>');
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  { email: 'test-alice@barry.dev', password: 'Testpass1!', name: 'Alice Test' },
  { email: 'test-bob@barry.dev',   password: 'Testpass1!', name: 'Bob Test'   },
];

// Resolve group by invite code using the admin client (bypasses RLS).
const { data: group, error: groupError } = await supabase
  .from('groups')
  .select('id, name')
  .eq('invite_code', INVITE_CODE)
  .single();

if (groupError || !group) {
  console.error(`Group not found for invite code "${INVITE_CODE}".`);
  process.exit(1);
}

console.log(`\nSeeding members into group: ${group.name} (${group.id})\n`);

for (const { email, password, name } of TEST_USERS) {
  // Create user if they don't exist yet; suppress "already exists" errors.
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,           // skip email verification
    user_metadata: { full_name: name },
  });

  let userId = created?.user?.id;

  if (createError) {
    if (createError.message?.includes('already been registered')) {
      // User exists — fetch their ID instead.
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) { console.error(`Could not list users: ${listError.message}`); continue; }
      userId = users.find(u => u.email === email)?.id;
    } else {
      console.error(`Could not create ${email}: ${createError.message}`);
      continue;
    }
  }

  if (!userId) { console.error(`Could not resolve user ID for ${email}`); continue; }

  // Add to group_members (upsert to handle re-runs).
  const { error: memberError } = await supabase
    .from('group_members')
    .upsert({ group_id: group.id, user_id: userId, role: 'member' }, { onConflict: 'group_id,user_id' });

  if (memberError) {
    console.error(`Could not add ${email} to group: ${memberError.message}`);
  } else {
    console.log(`✓ ${email}  (password: Testpass1!)`);
  }
}

console.log('\nDone. Sign in as each user in a separate browser session:');
console.log('  Chrome incognito → http://localhost:8081');
console.log('  Firefox          → http://localhost:8081\n');
