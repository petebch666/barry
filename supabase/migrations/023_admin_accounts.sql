-- Private beta without email: the developer creates testers' accounts and
-- resets forgotten passwords by hand, from the SQL editor or
--   supabase db query --remote "select * from admin.create_user('ana@example.org', 'Ana')"
--
-- The admin schema isn't exposed by the API (config.toml: public,
-- graphql_public) and no client role, service_role included, can use it.

CREATE SCHEMA admin;
REVOKE ALL ON SCHEMA admin FROM PUBLIC, anon, authenticated, service_role;

-- 12 characters from an alphabet without look-alikes (0/O, 1/l/I), easy to
-- read out or type from a message.
CREATE OR REPLACE FUNCTION admin.generate_password()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public, extensions
AS $$
  SELECT string_agg(substr(a, (get_byte(b, i) % length(a)) + 1, 1), '' ORDER BY i)
  FROM (SELECT 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'::text AS a,
               gen_random_bytes(12) AS b) r,
       generate_series(0, 11) AS i
$$;

-- Confirmed from the start, so no confirmation email is involved. The sign-up
-- trigger (003) creates the profile from full_name.
CREATE OR REPLACE FUNCTION admin.create_user(
  p_email TEXT,
  p_display_name TEXT,
  p_password TEXT DEFAULT NULL
)
RETURNS TABLE (user_id UUID, email TEXT, password TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_email TEXT := lower(btrim(p_email));
  v_name TEXT := btrim(p_display_name);
  v_password TEXT := COALESCE(p_password, admin.generate_password());
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid email: %', p_email;
  END IF;
  IF char_length(v_name) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'display name must be 1 to 50 characters';
  END IF;
  IF char_length(v_password) < 8 THEN
    RAISE EXCEPTION 'password must be at least 8 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.email = v_email) THEN
    RAISE EXCEPTION 'an account already exists for %', v_email;
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name),
    NOW(), NOW(), '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', NOW(), NOW(), NOW()
  );

  RETURN QUERY SELECT v_id, v_email, v_password;
END;
$$;

-- Also signs the account out everywhere: whoever forgot the password gets a
-- clean start, and a leaked one stops working at once.
CREATE OR REPLACE FUNCTION admin.set_password(p_email TEXT, p_password TEXT DEFAULT NULL)
RETURNS TABLE (email TEXT, password TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email TEXT := lower(btrim(p_email));
  v_password TEXT := COALESCE(p_password, admin.generate_password());
  v_id UUID;
BEGIN
  IF char_length(v_password) < 8 THEN
    RAISE EXCEPTION 'password must be at least 8 characters';
  END IF;

  UPDATE auth.users u
  SET encrypted_password = crypt(v_password, gen_salt('bf')), updated_at = NOW()
  WHERE u.email = v_email
  RETURNING u.id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'no account for %', v_email;
  END IF;

  DELETE FROM auth.sessions s WHERE s.user_id = v_id;

  RETURN QUERY SELECT v_email, v_password;
END;
$$;

REVOKE ALL ON FUNCTION admin.generate_password() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION admin.create_user(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION admin.set_password(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
