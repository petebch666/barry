# Barry

A social meetup coordination app for iOS and Android.

Send a **ping** to a group of friends ("anyone for a drink tonight?"), let everyone RSVP, and let the app figure out where to meet. Barry computes the **geographic barycenter** of all members who are in and suggests nearby venues. The group votes, and when a simple majority agrees, everyone gets a push notification confirming the meetup.

---

## How it works

1. **Ping** — send a ping to one of your groups with a message and optional proposed time
2. **RSVP** — members respond in/out/maybe; "in" members can optionally share their current location
3. **Barycenter** — the app computes the arithmetic mean of all "in" members' locations
4. **Venue suggestions** — Google Places Nearby Search (800 m radius from barycenter) + members' personal saved places are merged into a candidate list
5. **Vote** — members vote for their preferred venue; any member can also suggest an additional place
6. **Confirm** — when >50% of "in" members vote for the same venue, the meetup is confirmed and everyone gets a push notification

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 56 + React Native 0.85 |
| Language | TypeScript (strict) |
| Navigation | Expo Router v3 (file-based) |
| Backend | Supabase (PostgreSQL + Realtime + Edge Functions) |
| Auth | Google OAuth + Apple Sign In + Email/Password via Supabase |
| Maps | react-native-maps (Google Maps SDK) |
| Places | Google Places Nearby Search API (server-side only) |
| Location | expo-location (foreground, per-ping opt-in) |
| Push | expo-notifications + Expo Push API |
| Data fetching | TanStack React Query v5 |
| Validation | Zod v4 |
| Testing | Jest 29 + React Native Testing Library + pgTAP + Deno test |
| Build | EAS Build (cloud — required for Windows dev) |

---

## Project structure

```
barry/                          ← Expo project root
├── app/                        ← Expo Router file-based routes
│   ├── _layout.tsx             ← Root: auth gate, notification handler
│   ├── (auth)/                 ← Sign-in screen
│   ├── (app)/                  ← Authenticated app (bottom tabs)
│   │   ├── (feed)/             ← Ping feed + ping detail
│   │   ├── (groups)/           ← Groups list + group detail
│   │   ├── (map)/              ← Full-screen map tab
│   │   └── (profile)/          ← Profile + saved places
│   ├── create-group.tsx        ← Modal
│   ├── create-ping.tsx         ← Modal
│   ├── rsvp/[pingId].tsx       ← RSVP modal (in/out/maybe + location)
│   ├── suggest-place/[pingId]  ← Suggest a venue modal
│   └── join/[code].tsx         ← Invite deep-link landing
├── src/
│   ├── hooks/                  ← React Query hooks (one file per domain)
│   ├── lib/                    ← Supabase client singleton
│   ├── schemas/                ← Zod schemas + inferred TypeScript types
│   ├── types/                  ← database.types.ts (Supabase generated)
│   └── utils/                  ← Pure utilities (barycenter, haversine)
├── supabase/
│   ├── migrations/             ← SQL migrations (schema, RLS, triggers)
│   ├── functions/              ← Deno Edge Functions
│   │   ├── _shared/            ← Service role client factory
│   │   ├── send-push-notification/
│   │   ├── notify-group-on-ping/
│   │   ├── notify-voting-started/
│   │   ├── fetch-nearby-places/
│   │   └── check-vote-majority/
│   └── tests/
│       └── rls.sql             ← pgTAP RLS tests
├── app.json
├── eas.json
└── tsconfig.json
```

---

## Prerequisites

- Node.js 24 LTS
- [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli`
- [Supabase CLI](https://supabase.com/docs/guides/cli): `npm install -g supabase`
- A Supabase project (free tier works)
- A Google Cloud project with **Maps SDK** (Android + iOS) and **Places API** enabled
- **For local Android builds:** JDK 17, Android SDK, and an Android emulator (Pixel 9 AVD recommended)

---

## Setup

### 1. Install dependencies

```bash
cd barry
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required because expo-router pulls in react-dom@19 which conflicts with the react@19 peer resolution. This is a known Expo SDK 56 issue.

### 2. Environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

The anon key is safe to put in the client — all data access is gated by Row Level Security. **Never put the service role key in `.env.local` or anywhere in the client.**

### 3. Supabase — link and migrate

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 4. Supabase — secrets

Store the Google Places API key in Supabase Vault (never in the client bundle):

```bash
npx supabase secrets set GOOGLE_PLACES_KEY=<your-places-api-key>
```

### 5. Regenerate database types

After any migration:

```bash
npx supabase gen types typescript --linked > src/types/database.types.ts
```

### 6. EAS — link project

```bash
eas build:configure
```

This writes the EAS project ID into `app.json` under `extra.eas.projectId`. Push notifications **will not work** without this step.

### 7. Supabase — DB Webhooks

In the Supabase Dashboard → Database → Webhooks, create one webhook per Edge Function:

| Webhook name | Table | Events | Function URL |
|---|---|---|---|
| `notify-group-on-ping` | `pings` | INSERT | `.../functions/v1/notify-group-on-ping` |
| `notify-voting-started` | `pings` | UPDATE | `.../functions/v1/notify-voting-started` |
| `fetch-nearby-places` | `pings` | UPDATE | `.../functions/v1/fetch-nearby-places` |
| `check-vote-majority` | `votes` | INSERT, UPDATE | `.../functions/v1/check-vote-majority` |

---

## Development

### Local Android (recommended for day-to-day dev)

Requires JDK 17 and an Android emulator. Builds locally — no EAS account needed.

```bash
# First run: compiles all native modules (~25 min). Subsequent runs use Gradle cache (~2 min).
npx expo run:android
```

The Expo Dev Client shell is installed on the emulator and Metro starts automatically. On subsequent runs the native build is skipped and only the JS bundle is reloaded.

### Web preview (UI only — no maps, location, or push)

Useful for quickly iterating on screens that don't require native APIs.

```bash
npx expo export --platform web
npx serve dist
# Open http://localhost:3000
```

### EAS cloud build (no local Android SDK required)

```bash
eas build --platform android --profile development
```

> **Expo Go will not work.** `react-native-maps`, `expo-notifications`, and OAuth deep links all require a custom native build.

### Authentication in development

The sign-in screen supports **Google OAuth**, **Apple Sign In**, and **Email/Password**. For development and beta testing, add users directly in the Supabase Dashboard → **Authentication → Users → Add user**. The `handle_new_user` trigger auto-creates the matching `profiles` row.

To skip email confirmation during development: Supabase Dashboard → **Authentication → Providers → Email → disable "Confirm email"**.

---

## Building

### Android dev build (sideload APK — works on Windows without local SDK)

```bash
eas build --platform android --profile development
```

Download and sideload the APK onto a physical Android device or emulator. For local builds with the Android SDK installed, use `npx expo run:android` instead (faster iteration).

### iOS (requires Apple Developer account + registered UDID)

```bash
eas build --platform ios --profile development
```

Register your device UDID in the Apple Developer portal first, then install via EAS or TestFlight.

### Production

```bash
eas build --platform all --profile production
eas submit --platform all
```

---

## Testing

### Unit tests (Jest)

```bash
npm test
npm run test:watch
```

Tests live in `src/**/__tests__/` and `tests/`. Uses Jest 29 — do **not** upgrade to Jest 30, it is incompatible with jest-expo 56.

### Edge Function tests (Deno)

```bash
deno test supabase/functions/check-vote-majority/check-vote-majority.test.ts
deno test supabase/functions/fetch-nearby-places/fetch-nearby-places.test.ts
```

### Database / RLS tests (pgTAP)

Requires a local Supabase stack:

```bash
npx supabase start
npx supabase test db
```

---

## Security

- **No service role key on the client** — ever. It lives only in Edge Function environment variables.
- **RLS on every table** — no exceptions. The `is_group_member(gid)` SECURITY DEFINER helper keeps policy definitions concise.
- **Location data** is optional per ping. A pg_cron job nullifies `rsvps.latitude` / `rsvps.longitude` when a ping reaches a terminal state (confirmed or cancelled).
- **Google Places API key** is stored in Supabase Vault only. The Google Maps SDK key (map rendering) is restricted in Google Cloud Console to the app's bundle ID and has no access to Places.
- **PKCE flow** is used for all OAuth — authorization codes cannot be intercepted without the code verifier.
- **Push tokens** are deleted from `push_tokens` on sign-out and re-registered fresh on next sign-in.

---

## Deep links

The app handles the `barry://` URL scheme:

| URL | Destination |
|---|---|
| `barry://join/<code>` | Group invite landing screen |
| `barry://auth/callback` | OAuth redirect (handled internally) |

Push notification taps deep-link to `/(app)/(feed)/ping/<pingId>`.
