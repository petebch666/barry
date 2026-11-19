import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { useCreateGroup } from '@/hooks/useGroups';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

const from = jest.mocked(supabase.from);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    // Infinity: no garbage-collection timers left running to keep Jest alive.
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCreateGroup', () => {
  const realCrypto = globalThis.crypto;

  beforeEach(() => {
    // Hermes (the iOS/Android engine) has no global crypto.
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'user-1' } } } as never);
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true });
  });

  it('creates the group and its admin without client-side crypto or invite code', async () => {
    const groupInsert = jest.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'g-1', invite_code: 'A1B2C3D4' }, error: null }) }),
    });
    const memberInsert = jest.fn().mockResolvedValue({ error: null });
    from.mockImplementation(((table: string) => ({ insert: table === 'groups' ? groupInsert : memberInsert })) as never);

    const { result } = await renderHook(() => useCreateGroup(), { wrapper });
    let group: unknown;
    await act(async () => { group = await result.current.mutateAsync({ name: 'Friends' }); });

    expect(groupInsert).toHaveBeenCalledWith({ name: 'Friends', created_by: 'user-1' });
    expect(memberInsert).toHaveBeenCalledWith({ group_id: 'g-1', user_id: 'user-1', role: 'admin' });
    expect(group).toEqual({ id: 'g-1', invite_code: 'A1B2C3D4' });
  });
});
