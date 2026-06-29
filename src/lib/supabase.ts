import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '../types/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill in your Supabase project values.',
  );
}

/**
 * Singleton Supabase client for use throughout the app.
 *
 * Security notes:
 * - Uses the anon key only. The service role key never touches the client.
 * - PKCE flow is enforced for OAuth to prevent authorization code interception.
 * - Refresh tokens rotate on every use (Supabase default).
 * - Sessions are persisted in AsyncStorage; for higher sensitivity, swap for
 *   expo-secure-store by replacing the storage adapter below.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
