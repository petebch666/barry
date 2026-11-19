import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isServiceCall } from './auth.ts';

const req = (auth?: string) =>
  new Request('http://localhost', { method: 'POST', headers: auth ? { Authorization: auth } : {} });

Deno.test('isServiceCall — accepts the service key', () => {
  assertEquals(isServiceCall(req('Bearer secret-key'), 'secret-key'), true);
});

Deno.test('isServiceCall — rejects a missing header', () => {
  assertEquals(isServiceCall(req(), 'secret-key'), false);
});

Deno.test('isServiceCall — rejects another key, such as the public anon key', () => {
  assertEquals(isServiceCall(req('Bearer anon-key'), 'secret-key'), false);
});

Deno.test('isServiceCall — rejects a prefix of the key', () => {
  assertEquals(isServiceCall(req('Bearer secret'), 'secret-key'), false);
});

Deno.test('isServiceCall — rejects everything when the key is not configured', () => {
  assertEquals(isServiceCall(req('Bearer '), ''), false);
});
