import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { useMyPingOutcome, useSendFeedback } from '@/hooks/useFeedback';
import { SendFeedbackSchema } from '@/schemas';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.3' } }));

const PING = '550e8400-e29b-41d4-a716-446655440000';
const from = jest.mocked(supabase.from);

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

describe('SendFeedbackSchema', () => {
  it('accepts general feedback with a message', () => {
    expect(SendFeedbackSchema.safeParse({ kind: 'general', message: 'Nice' }).success).toBe(true);
  });

  it('rejects general feedback that is only whitespace', () => {
    expect(SendFeedbackSchema.safeParse({ kind: 'general', message: '   ' }).success).toBe(false);
  });

  it('rejects a message over 1000 characters', () => {
    expect(SendFeedbackSchema.safeParse({ kind: 'general', message: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('accepts a ping outcome with just a rating', () => {
    expect(SendFeedbackSchema.safeParse({ kind: 'ping_outcome', ping_id: PING, rating: 'down' }).success).toBe(true);
  });

  it('rejects a ping outcome without a rating', () => {
    expect(SendFeedbackSchema.safeParse({ kind: 'ping_outcome', ping_id: PING }).success).toBe(false);
  });

  it('rejects a ping outcome with a non-UUID ping', () => {
    expect(SendFeedbackSchema.safeParse({ kind: 'ping_outcome', ping_id: 'abc', rating: 'up' }).success).toBe(false);
  });
});

describe('useSendFeedback', () => {
  function mockInsert(error: Error | null = null) {
    const insert = jest.fn().mockResolvedValue({ error });
    from.mockReturnValue({ insert } as never);
    return insert;
  }

  it('sends a ping outcome with its context', async () => {
    const insert = mockInsert();
    const { result } = await renderHook(() => useSendFeedback(), { wrapper });
    await act(() => result.current.mutateAsync({ kind: 'ping_outcome', ping_id: PING, rating: 'up', message: '' }));

    expect(from).toHaveBeenCalledWith('feedback');
    expect(insert).toHaveBeenCalledWith({
      kind: 'ping_outcome',
      rating: 'up',
      message: null,
      ping_id: PING,
      app_version: '1.2.3',
      platform: 'ios',
    });
  });

  it('trims general feedback and attaches no ping', async () => {
    const insert = mockInsert();
    const { result } = await renderHook(() => useSendFeedback(), { wrapper });
    await act(() => result.current.mutateAsync({ kind: 'general', message: '  Love it  ' }));

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'general', message: 'Love it', rating: null, ping_id: null,
    }));
  });

  it('never writes invalid feedback', async () => {
    const insert = mockInsert();
    const { result } = await renderHook(() => useSendFeedback(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ kind: 'general', message: ' ' })).rejects.toThrow();
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('surfaces a database error', async () => {
    mockInsert(new Error('duplicate'));
    const { result } = await renderHook(() => useSendFeedback(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ kind: 'general', message: 'x' })).rejects.toThrow('duplicate');
    });
  });
});

describe('useMyPingOutcome', () => {
  function mockSelect(data: { rating: string } | null) {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
    };
    from.mockReturnValue(query as never);
    return query;
  }

  it('returns the rating for this ping', async () => {
    const query = mockSelect({ rating: 'down' });
    const { result } = await renderHook(() => useMyPingOutcome(PING), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('down');
    expect(query.eq).toHaveBeenCalledWith('kind', 'ping_outcome');
    expect(query.eq).toHaveBeenCalledWith('ping_id', PING);
  });

  it('returns null when not rated yet', async () => {
    mockSelect(null);
    const { result } = await renderHook(() => useMyPingOutcome(PING), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
