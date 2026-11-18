import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { deregisterPushToken } from '@/hooks/usePushToken';
import { useDeleteAccount, useExportMyData } from '@/hooks/useProfile';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    removeAllChannels: jest.fn(),
    auth: { signOut: jest.fn() },
  },
}));
jest.mock('@/hooks/usePushToken', () => ({ deregisterPushToken: jest.fn() }));

const rpc = jest.mocked(supabase.rpc);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    // Infinity: no garbage-collection timers left running to keep Jest alive.
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

describe('useDeleteAccount', () => {
  it('cleans up, deletes the account, then signs out', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null } as never);
    const { result } = await renderHook(() => useDeleteAccount(), { wrapper });
    await act(() => result.current.mutateAsync());

    expect(deregisterPushToken).toHaveBeenCalled();
    expect(supabase.removeAllChannels).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('delete_user');
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('stays signed in when the deletion fails', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('blocked') } as never);
    const { result } = await renderHook(() => useDeleteAccount(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('blocked');
    });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});

describe('useExportMyData', () => {
  it('returns the export', async () => {
    rpc.mockResolvedValueOnce({ data: { profile: { display_name: 'Bob' } }, error: null } as never);
    const { result } = await renderHook(() => useExportMyData(), { wrapper });
    let data: unknown;
    await act(async () => { data = await result.current.mutateAsync(); });
    expect(rpc).toHaveBeenCalledWith('export_my_data');
    expect(data).toEqual({ profile: { display_name: 'Bob' } });
  });

  it('surfaces an error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('denied') } as never);
    const { result } = await renderHook(() => useExportMyData(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('denied');
    });
  });
});
