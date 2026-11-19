import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { useExchangeAuthCode, useRequestPasswordReset, useSetNewPassword } from '@/hooks/useAuth';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      exchangeCodeForSession: jest.fn(),
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
