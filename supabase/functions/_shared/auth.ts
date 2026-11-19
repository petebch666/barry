// Every function here is internal: called by database triggers, the cron job
// or a sibling function, always with the service-role key. Several are
// deployed with verify_jwt off, so without this check anyone holding the URL
// could post a fake webhook payload (send pushes, insert venues).
export function isServiceCall(req: Request, serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')): boolean {
  if (!serviceKey) return false;
  const header = req.headers.get('Authorization') ?? '';
  return timingSafeEqual(header, `Bearer ${serviceKey}`);
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
