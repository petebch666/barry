import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { authRedirect } from '@/lib/authRedirect';
import { EmailAuthSchema } from '@/schemas';

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const parsed = EmailAuthSchema.shape.email.parse(email.trim());
      const { error } = await supabase.auth.resetPasswordForEmail(parsed, {
        redirectTo: authRedirect('reset-password'),
      });
      if (error) throw error;
    },
  });
}

export function useSetNewPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const parsed = EmailAuthSchema.shape.password.parse(password);
      const { error } = await supabase.auth.updateUser({ password: parsed });
      if (error) throw error;
    },
  });
}

/**
 * Turns the one-time code an email link carries into a session. PKCE: it only
 * works on the device and browser that asked for the email, which holds the
 * matching code verifier.
 */
export function useExchangeAuthCode(code: string | undefined) {
  return useQuery({
    queryKey: ['auth', 'exchange', code],
    queryFn: async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code as string);
      if (error) throw error;
      return true;
    },
    enabled: !!code,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
