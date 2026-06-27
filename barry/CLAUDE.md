@AGENTS.md

# Barry — Claude Code Instructions

## Repository layout

The git root is `C:\dev\barry`. The Expo project lives one level down at `C:\dev\barry\barry`.

- Run **npm / expo / jest** commands from `C:\dev\barry\barry`
- Run **git** commands from `C:\dev\barry`
- Run **supabase** commands from `C:\dev\barry\barry` (that's where `supabase/config.toml` lives)

## Essential commands

```bash
# Start
npm start

# Test (Jest 29 — do NOT upgrade to 30, breaks jest-expo 56)
npm test
npm run test:watch

# Deno Edge Function tests
deno test supabase/functions/check-vote-majority/check-vote-majority.test.ts
deno test supabase/functions/fetch-nearby-places/fetch-nearby-places.test.ts

# DB/RLS tests
npx supabase start
npx supabase test db

# Type generation (run after every migration)
npx supabase gen types typescript --linked > src/types/database.types.ts

# DB migrations
npx supabase db push

# EAS builds
eas build --platform android --profile development    # sideload APK
eas build --platform ios     --profile development    # needs Apple UDID
eas build --platform all     --profile production
```

## Dependency installs

Always use `--legacy-peer-deps` for any npm install that is not an Expo-managed package:

```bash
npm install <pkg> --legacy-peer-deps --save-dev
```

expo-managed packages (react-native-*, expo-*) use `npx expo install` — no flag needed.

## Architecture

```
app/            Expo Router file-based routes
src/hooks/      React Query hooks — one file per domain (useGroups, usePings, useRsvps, usePlaces, useVotes, useProfile, usePushToken)
src/lib/        Supabase client singleton (PKCE, AsyncStorage session)
src/schemas/    Zod schemas + inferred TypeScript types (single source of truth)
src/types/      database.types.ts — regenerated from Supabase; do not hand-edit
src/utils/      Pure functions: barycenter.ts (computeBarycenter, haversineMeters)
supabase/
  migrations/   001_init_schema, 002_rls_policies, 003_triggers
  functions/    Deno Edge Functions (triggered via DB Webhooks, never called by client)
  tests/        rls.sql (pgTAP)
```

## Code conventions

- **TypeScript strict mode** — `strict: true` in tsconfig; no `any`, no non-null assertions without a comment explaining why
- **Zod at all boundaries** — validate webhook payloads in Edge Functions; validate user input before DB writes
- **Path alias** — always import with `@/` (maps to `src/`), never with relative `../../`
- **One hook per domain** — hooks own all Supabase calls for their domain; screens never call `supabase` directly
- **React Query for all async state** — no `useState` + `useEffect` for data fetching; use `useQuery` / `useMutation`
- **Realtime channels** — always call `supabase.removeChannel(channel)` on unmount; call `supabase.removeAllChannels()` on sign-out
- **Comments** — only write a comment when the WHY is non-obvious; no what-comments, no docstrings on self-explanatory functions
- **No premature abstraction** — three similar lines is better than a premature helper

## Security rules — non-negotiable

1. **Service role key never on the client.** It exists only in Edge Function environment variables. The client uses the anon key only.
2. **RLS on every table, no exceptions.** New tables must have RLS enabled and policies added to `002_rls_policies.sql` before shipping.
3. **Google Places API key in Supabase Vault only.** Never in `app.json`, `.env.local`, or any file tracked by git. Set with `npx supabase secrets set GOOGLE_PLACES_KEY=...`.
4. **The Google Maps SDK key** (client-side, for map rendering only) must be restricted in Google Cloud Console to the app bundle ID and granted no Places/other API access.
5. **PKCE flow** — `flowType: 'pkce'` must remain set in `src/lib/supabase.ts`. Do not switch to `implicit`.
6. **Location data minimal retention** — `rsvps.latitude` and `rsvps.longitude` are nullified by pg_cron after a ping reaches a terminal state. Do not add queries that persist or export location beyond the ping lifecycle.
7. **Input validation** — all user-supplied text must pass through the relevant Zod schema before any DB write. Max lengths are enforced at both schema and DB level.

## Testing requirements

Every new feature must ship with:
- **Unit tests** for any pure logic (utils, schema parsing, vote counting)
- **Hook tests** with a mocked Supabase client if the hook contains non-trivial branching
- **Deno tests** for any new Edge Function with significant business logic
- **pgTAP tests** for any new RLS policy

Tests live in:
- `src/**/__tests__/` — unit tests (Jest)
- `tests/integration/` — integration tests (Jest + local Supabase)
- `supabase/functions/<name>/<name>.test.ts` — Deno Edge Function tests
- `supabase/tests/rls.sql` — pgTAP

## Known pitfalls

- **Jest 30 breaks jest-expo 56** — `clearMocksOnScope is not a function`. Stay on Jest 29.
- **`testPathPattern` is a CLI flag**, not a jest config key — use `testMatch` in package.json instead.
- **Expo Go does not work** — `react-native-maps`, push notifications, and OAuth all require a custom EAS dev build.
- **EAS project ID is required for push tokens** — `getExpoPushTokenAsync` silently returns null without it. Run `eas build:configure` first.
- **`npx supabase init` exit code 1** — this is a PostHog analytics timeout, not an actual failure. Check that `supabase/config.toml` was created; if it was, proceed normally.
- **Two Google API keys** — one for Maps SDK (client), one for Places API (server-side Vault only). They must never be swapped.
- **Apple Sign In only works on a physical device** — cannot be tested in simulator.
- **Windows + iOS** — no local Xcode. All iOS builds go through EAS. Register device UDID in Apple Developer portal before requesting a dev build.
- **pg_cron availability** — the triggers migration registers cron jobs conditionally (`IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')`). Enable pg_cron in the Supabase Dashboard under Database → Extensions before running migrations in production.
