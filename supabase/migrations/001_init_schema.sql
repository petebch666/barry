-- ============================================================
-- Barry — initial schema
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── profiles ───────────────────────────────────────────────
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── push_tokens ────────────────────────────────────────────
CREATE TABLE push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── groups ─────────────────────────────────────────────────
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  description TEXT CHECK (char_length(description) <= 200),
  avatar_url  TEXT,
  created_by  UUID NOT NULL REFERENCES profiles(id),
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── group_members ──────────────────────────────────────────
CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- ─── pings ──────────────────────────────────────────────────
CREATE TABLE pings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by         UUID NOT NULL REFERENCES profiles(id),
  message            TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  proposed_time      TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'voting', 'confirmed', 'cancelled')),
  confirmed_place_id UUID,           -- FK added after places table is created
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '8 hours'),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── rsvps ──────────────────────────────────────────────────
CREATE TABLE rsvps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ping_id             UUID NOT NULL REFERENCES pings(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status              TEXT NOT NULL CHECK (status IN ('in', 'out', 'maybe')),
  -- Location is nullable: only set when the user explicitly opts in per ping.
  -- Nulled out once the ping reaches a terminal state (confirmed/cancelled).
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  location_updated_at TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ping_id, user_id)
);

-- ─── places ─────────────────────────────────────────────────
CREATE TABLE places (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ping_id      UUID NOT NULL REFERENCES pings(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  address      TEXT,
  latitude     DOUBLE PRECISION NOT NULL,
  longitude    DOUBLE PRECISION NOT NULL,
  category     TEXT,
  source       TEXT NOT NULL CHECK (source IN ('google_places', 'manual')),
  external_id  TEXT,
  photo_url    TEXT,
  rating       REAL CHECK (rating BETWEEN 0 AND 5),
  suggested_by UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now we can add the FK from pings to places
ALTER TABLE pings
  ADD CONSTRAINT pings_confirmed_place_id_fkey
    FOREIGN KEY (confirmed_place_id) REFERENCES places(id);

-- ─── votes ──────────────────────────────────────────────────
CREATE TABLE votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ping_id    UUID NOT NULL REFERENCES pings(id) ON DELETE CASCADE,
  place_id   UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One vote per user per ping; upsert on place_id to change vote
  UNIQUE (ping_id, user_id)
);

-- ─── saved_places ────────────────────────────────────────────
CREATE TABLE saved_places (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  address         TEXT,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  category        TEXT,
  google_place_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX ON rsvps (ping_id, status);
CREATE INDEX ON votes (ping_id);
CREATE INDEX ON pings (group_id, status);
-- Covers "what groups am I in?" — the most frequent query in the app
CREATE INDEX ON group_members (user_id);
CREATE INDEX ON push_tokens (user_id);
CREATE INDEX ON saved_places (user_id);
