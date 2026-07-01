# Barry — Agent Instructions

## Expo version

This project uses **Expo SDK 56**. The API surface changes significantly between major versions.
Before writing any Expo or React Native code, consult the exact versioned docs:
**https://docs.expo.dev/versions/v56.0.0/**

Do not rely on training-data knowledge of Expo APIs — check the docs.

---

## Repository layout

```
C:\dev\barry\          ← git root and Expo project root (run all commands here)
├── app\               ← Expo Router v3 file-based routes
├── src\               ← hooks, lib, schemas, types, utils
├── supabase\          ← migrations, Edge Functions, pgTAP tests
├── CLAUDE.md          ← full dev instructions (read this too)
└── eas.json
```

---

## Before writing any code

1. **Read CLAUDE.md** — it has the full architecture, all security rules, known pitfalls, and testing requirements.
2. **Check the existing hooks** in `src/hooks/` before creating new ones — the domain is likely already covered.
3. **Check `src/schemas/index.ts`** before defining new types — use the existing Zod types; do not duplicate.
4. **Check `src/types/database.types.ts`** for table/column names before writing any Supabase query.

---

## Hard rules

### Security (non-negotiable)
- The **service role key** must never appear in any client-side file. It lives only in Edge Function env vars.
- **RLS must be enabled** on every new table. Add policies to `supabase/migrations/002_rls_policies.sql`.
- **Place data uses OpenStreetMap/Overpass API** — no API key required. Do not add Google Places API calls.
- **`flowType: 'pkce'`** must remain set in `src/lib/supabase.ts`. Do not change auth flow.
- Location data (`rsvps.latitude`, `rsvps.longitude`) must not be persisted beyond ping lifecycle — the pg_cron nullification in `supabase/migrations/003_triggers.sql` is load-bearing.

### Dependencies
- All npm installs that are not Expo-managed require `--legacy-peer-deps`.
- Expo-managed packages use `npx expo install` (no flag).
- **Do not upgrade Jest past 29** — Jest 30 is incompatible with jest-expo 56.

### Code style
- Import with `@/` path alias, never relative `../../`.
- Screens never call `supabase` directly — all DB access goes through hooks in `src/hooks/`.
- Always call `supabase.removeChannel(channel)` on unmount for any Realtime subscription.
- No `useState` + `useEffect` for data fetching — use React Query (`useQuery` / `useMutation`).
- Validate all user input and all webhook payloads with the Zod schemas in `src/schemas/index.ts`.

### Testing
Every feature must ship with tests. Refer to CLAUDE.md for test locations and tooling. The test runner for Edge Functions is **Deno**, not Jest.

---

## What Expo Go cannot do

Expo Go **does not work** for this project. The following features all require a custom EAS dev build:
- `react-native-webview` (maps)
- `expo-notifications` (push tokens)
- Apple OAuth deep links (`barry://` scheme)

Build with `eas build --platform android --profile development` for a sideloadable APK.

---

## Edge Functions

Edge Functions live in `supabase/functions/`. They are triggered by Supabase DB Webhooks — the client **never calls them directly**.

Each function receives the full DB row in `req.json()` as `{ record, old_record, type, table, schema }`. Always validate this payload with Zod before processing.

The shared service role client is in `supabase/functions/_shared/supabase-client.ts`. Import it with `import { createServiceClient } from '../_shared/supabase-client.ts'`.

---

## Database

Run migrations with `npx supabase db push`. After any schema change, regenerate types:

```bash
npx supabase gen types typescript --linked > src/types/database.types.ts
```

Do not hand-edit `database.types.ts` — it is overwritten on every regen.

The `is_group_member(gid uuid)` SECURITY DEFINER function in `002_rls_policies.sql` is used by nearly every RLS policy. Do not drop or rename it.
