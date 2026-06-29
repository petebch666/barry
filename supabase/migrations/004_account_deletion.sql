-- ============================================================
-- Barry — account self-deletion RPC
-- ============================================================

-- SECURITY DEFINER is required: regular users cannot DELETE from auth.users.
-- The function validates the caller via auth.uid() so a user can only delete
-- their own row. All child rows cascade automatically (ON DELETE CASCADE).
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Restrict invocation to authenticated users only.
REVOKE ALL ON FUNCTION delete_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;
