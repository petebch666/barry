-- ============================================================
-- Replace auth.role() = 'authenticated' with auth.uid() IS NOT NULL.
-- auth.role() can be unreliable with PKCE sessions; auth.uid() IS NOT NULL
-- is the canonical modern Supabase check for "caller is signed in".
-- ============================================================

-- profiles: any auth user can read
DROP POLICY IF EXISTS "profiles: any auth user can read" ON profiles;
CREATE POLICY "profiles: any auth user can read"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- groups: any auth user can create
DROP POLICY IF EXISTS "groups: any auth user can create" ON groups;
CREATE POLICY "groups: any auth user can create"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
