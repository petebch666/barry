// Private beta: accounts are created by hand (023_admin_accounts.sql) and the
// project sends no email, so everything that depends on email is hidden:
// sign-up, "Forgot password?", and Sign in with Apple (a first Apple login is
// a sign-up, which is disabled in Supabase). Set to false for a public launch,
// together with re-enabling sign-ups and configuring an SMTP sender.
export const INVITE_ONLY = true;
