import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Service-role client for Edge Functions.
 *
 * Security note: this key bypasses RLS. It is only used in Edge Functions that
 * operate on behalf of multiple users (e.g. fanning out push notifications).
 * It is never exposed to client bundles.
 */
export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}
