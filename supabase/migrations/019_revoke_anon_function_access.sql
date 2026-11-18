-- Supabase's default privileges grant EXECUTE on every new public function to
-- anon, and REVOKE ... FROM PUBLIC does not remove that. So signed-out callers
-- holding the public key could run every SECURITY DEFINER function, including
-- the ping-expiry and location-erasure jobs and the invite-code lookup.
--
-- is_group_member, is_group_admin and shares_group_with stay callable: RLS
-- policies aren't role-scoped, so they run for anon too, and return false
-- without a user.

REVOKE EXECUTE ON FUNCTION delete_user() FROM anon;
REVOKE EXECUTE ON FUNCTION lookup_group_by_invite_code(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION request_more_places(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION handle_member_departure() FROM PUBLIC, anon, authenticated;

-- Scheduled jobs: run by pg_cron as postgres, never by clients.
REVOKE EXECUTE ON FUNCTION cancel_expired_pings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION nullify_terminal_ping_locations() FROM PUBLIC, anon, authenticated;

-- Future functions created by migrations stop being callable by anon unless
-- granted explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
