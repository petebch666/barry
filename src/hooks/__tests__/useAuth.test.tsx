import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { useChangePassword, useExchangeAuthCode, useRequestPasswordReset, useSetNewPassword } from '@/hooks/useAuth';
import { ChangePasswordSchema } from '@/schemas';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
    },
  },
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: ({ scheme, path }: { scheme: string; path: string }) => `${scheme}://${path}`,
}));

const auth = jest.mocked(supabase.auth);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    // Infinity: no garbage-collection timers left running to keep Jest alive.
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

describe('useRequestPasswordReset', () => {
  it('sends the reset email with a link back into the app', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null } as never);
    const { result } = await renderHook(() => useRequestPasswordReset(), { wrapper });
    await act(() => result.current.mutateAsync('  bob@example.org '));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('bob@example.org', {
      redirectTo: 'barry://reset-password',
    });
  });

  it('rejects an invalid email without calling Supabase', async () => {
    const { result } = await renderHook(() => useRequestPasswordReset(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('not-an-email')).rejects.toThrow();
    });
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('useSetNewPassword', () => {
  it('saves a valid password', async () => {
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: null } as never);
    const { result } = await renderHook(() => useSetNewPassword(), { wrapper });
    await act(() => result.current.mutateAsync('long-enough'));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'long-enough' });
  });

  it('rejects a password under 8 characters', async () => {
    const { result } = await renderHook(() => useSetNewPassword(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('short')).rejects.toThrow();
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('useExchangeAuthCode', () => {
  it('exchanges the code once', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null } as never);
    const { result } = await renderHook(() => useExchangeAuthCode('abc'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('does nothing without a code', async () => {
    const { result } = await renderHook(() => useExchangeAuthCode(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports an expired or foreign code as an error', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: new Error('invalid flow state') } as never);
    const { result } = await renderHook(() => useExchangeAuthCode('old'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('ChangePasswordSchema', () => {
  it('accepts a new password of 8+ characters', () => {
    expect(ChangePasswordSchema.safeParse({ current: 'old-password', next: 'new-password' }).success).toBe(true);
  });

  it('rejects reusing the current password', () => {
    expect(ChangePasswordSchema.safeParse({ current: 'same-password', next: 'same-password' }).success).toBe(false);
  });

  it('rejects a short new password', () => {
    expect(ChangePasswordSchema.safeParse({ current: 'old-password', next: 'short' }).success).toBe(false);
  });
});

describe('useChangePassword', () => {
  beforeEach(() => {
    auth.getUser.mockResolvedValue({ data: { user: { email: 'ana@example.org' } }, error: null } as never);
  });

  it('checks the current password, then saves the new one', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null } as never);
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: null } as never);
    const { result } = await renderHook(() => useChangePassword(), { wrapper });
    await act(() => result.current.mutateAsync({ current: 'old-password', next: 'new-password' }));

    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.org', password: 'old-password' });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
  });

  it('refuses when the current password is wrong', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: new Error('Invalid login credentials') } as never);
    const { result } = await renderHook(() => useChangePassword(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ current: 'wrong-pass', next: 'new-password' }))
        .rejects.toThrow('Your current password is incorrect');
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
