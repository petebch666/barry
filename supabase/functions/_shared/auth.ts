// Every function here is internal: called by database triggers, the cron job
// or a sibling function, always with a service-level key. Several are
// deployed with verify_jwt off, so without this check anyone holding the URL
// could post a fake webhook payload (send pushes, insert venues).
//
// Callers don't all hold the same key: siblings send this function's
// SUPABASE_SERVICE_ROLE_KEY, while the Vault (cron, triggers) holds a
// separately issued secret key. Rather than assume a format, any key the
// Auth admin API accepts counts, since only service-level keys can call it.

const verifiedKeys = new Set<string>();

interface AuthEnv {
  supabaseUrl?: string;
  serviceKey?: string;
  fetchFn?: typeof fetch;
}

export async function isServiceCall(req: Request, env: AuthEnv = {}): Promise<boolean> {
  const {
    supabaseUrl = Deno.env.get('SUPABASE_URL'),
    serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    fetchFn = fetch,
  } = env;

  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const key = header.slice('Bearer '.length);
  if (!key) return false;

  if (serviceKey && timingSafeEqual(key, serviceKey)) return true;
  if (verifiedKeys.has(key)) return true;
  if (!supabaseUrl) return false;

  const res = await fetchFn(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  await res.body?.cancel();
  if (!res.ok) return false;
  verifiedKeys.add(key);
  return true;
}

export function forbidden(): Response {
  return Response.json({ error: 'forbidden' }, { status: 403 });
}

function timingSafeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
