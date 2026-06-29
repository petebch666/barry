-- Invite-code lookup bypasses the members-only SELECT policy so that a
-- non-member can resolve a group name before joining. SECURITY DEFINER runs
-- as the function owner and exposes only the three columns the join screen
-- needs — it never returns invite_code or created_by to the caller.
CREATE OR REPLACE FUNCTION lookup_group_by_invite_code(code text)
RETURNS TABLE(id uuid, name text, description text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description
  FROM groups
  WHERE invite_code = upper(code);
$$;
