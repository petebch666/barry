import { makeRedirectUri } from 'expo-auth-session';

// barry://<path> in the app, <origin>/<path> on web. Each must be listed in
// Supabase → Authentication → URL Configuration → Redirect URLs.
export function authRedirect(path: 'auth/callback' | 'reset-password'): string {
  return makeRedirectUri({ scheme: 'barry', path });
}
