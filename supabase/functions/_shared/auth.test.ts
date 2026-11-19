import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isServiceCall } from './auth.ts';

const req = (auth?: string) =>
  new Request('http://localhost', { method: 'POST', headers: auth ? { Authorization: auth } : {} });

function fakeAuthApi(acceptedKey: string) {
  const calls: string[] = [];
  const fetchFn = ((url: string, init?: RequestInit) => {
    const key = new Headers(init?.headers).get('apikey') ?? '';
    calls.push(`${url} ${key}`);
    return Promise.resolve(new Response('{}', { status: key === acceptedKey ? 200 : 401 }));
  }) as typeof fetch;
  return { fetchFn, calls };
}

const URL = 'https://project.supabase.co';

Deno.test('isServiceCall — accepts the function\'s own service key without a lookup', async () => {
  const { fetchFn, calls } = fakeAuthApi('nothing');
  assertEquals(await isServiceCall(req('Bearer own-key'), { supabaseUrl: URL, serviceKey: 'own-key', fetchFn }), true);
  assertEquals(calls.length, 0);
});

Deno.test('isServiceCall — accepts another key the Auth admin API accepts, then caches it', async () => {
  const { fetchFn, calls } = fakeAuthApi('vault-key');
  const env = { supabaseUrl: URL, serviceKey: 'own-key', fetchFn };
  assertEquals(await isServiceCall(req('Bearer vault-key'), env), true);
  assertEquals(await isServiceCall(req('Bearer vault-key'), env), true);
  assertEquals(calls, [`${URL}/auth/v1/admin/users?per_page=1 vault-key`]);
});

Deno.test('isServiceCall — rejects a key the Auth admin API refuses, such as the anon key', async () => {
  const { fetchFn } = fakeAuthApi('vault-key');
  assertEquals(await isServiceCall(req('Bearer anon-key'), { supabaseUrl: URL, serviceKey: 'own-key', fetchFn }), false);
});

Deno.test('isServiceCall — rejects a missing or malformed header without a lookup', async () => {
  const { fetchFn, calls } = fakeAuthApi('vault-key');
  const env = { supabaseUrl: URL, serviceKey: 'own-key', fetchFn };
  assertEquals(await isServiceCall(req(), env), false);
  assertEquals(await isServiceCall(req('Basic abc'), env), false);
  assertEquals(await isServiceCall(req('Bearer '), env), false);
  assertEquals(calls.length, 0);
});

Deno.test('isServiceCall — rejects a prefix of the service key', async () => {
  const { fetchFn } = fakeAuthApi('nothing');
  assertEquals(await isServiceCall(req('Bearer own'), { supabaseUrl: URL, serviceKey: 'own-key', fetchFn }), false);
});
