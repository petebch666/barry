-- Invite codes were generated on the client with crypto.getRandomValues,
-- which Hermes (the iOS/Android JS engine) doesn't provide: creating a group
-- failed on phones with "Property 'crypto' doesn't exist" (web was fine).
-- The database now generates them; clients that still send one keep working.

-- Same format as before: 8 uppercase hex characters.
-- SECURITY DEFINER so the uniqueness check sees every group, not only the
-- caller's (RLS); it returns nothing but a fresh code. Authenticated keeps
-- EXECUTE because a column default runs as the inserting user.
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  code TEXT;
BEGIN
  LOOP
    code := upper(encode(gen_random_bytes(4), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM groups WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

REVOKE ALL ON FUNCTION generate_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_invite_code() TO authenticated, service_role;

ALTER TABLE groups ALTER COLUMN invite_code SET DEFAULT generate_invite_code();
