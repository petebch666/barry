import { z } from 'zod';

// ─── Shared primitives ───────────────────────────────────────────────────────

export const LatLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// ─── Profiles ────────────────────────────────────────────────────────────────

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(1).max(50),
  avatar_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
});

// ─── Groups ──────────────────────────────────────────────────────────────────

export const GroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().max(200).nullable(),
  avatar_url: z.string().url().nullable(),
  created_by: z.string().uuid(),
  invite_code: z.string().length(8),
  created_at: z.string().datetime(),
});

export const CreateGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(200).optional(),
});

// ─── Pings ───────────────────────────────────────────────────────────────────

export const PingStatusSchema = z.enum(['open', 'voting', 'confirmed', 'cancelled']);

export const PingSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  created_by: z.string().uuid(),
  message: z.string().min(1).max(500),
  proposed_time: z.string().datetime().nullable(),
  status: PingStatusSchema,
  confirmed_place_id: z.string().uuid().nullable(),
  expires_at: z.string().datetime(),
  vote_timer_minutes: z.number().int().positive().nullable(),
  voting_deadline: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export const CreatePingSchema = z.object({
  group_id: z.string().uuid(),
  message: z.string().min(1, 'Message is required').max(500),
  proposed_time: z.string().datetime().nullable().optional(),
  vote_timer_minutes: z.number().int().positive().nullable().optional(),
});

// ─── RSVPs ───────────────────────────────────────────────────────────────────

export const RsvpStatusSchema = z.enum(['in', 'out', 'maybe']);

export const RsvpSchema = z.object({
  id: z.string().uuid(),
  ping_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: RsvpStatusSchema,
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  location_updated_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime(),
});

export const UpsertRsvpSchema = z.object({
  ping_id: z.string().uuid(),
  status: RsvpStatusSchema,
  location: LatLngSchema.nullable().optional(),
});

// ─── Places ──────────────────────────────────────────────────────────────────

export const PlaceSourceSchema = z.enum(['osm', 'manual']);

export const PlaceSchema = z.object({
  id: z.string().uuid(),
  ping_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  address: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  category: z.string().nullable(),
  source: PlaceSourceSchema,
  external_id: z.string().nullable(),
  photo_url: z.string().url().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  suggested_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
});

export const SuggestPlaceSchema = z.object({
  ping_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  address: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  category: z.string().optional(),
  external_id: z.string().optional(),
  photo_url: z.string().url().optional(),
  rating: z.number().min(0).max(5).optional(),
});

// ─── Votes ───────────────────────────────────────────────────────────────────

export const VoteSchema = z.object({
  id: z.string().uuid(),
  ping_id: z.string().uuid(),
  place_id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime(),
});

export const CastVoteSchema = z.object({
  ping_id: z.string().uuid(),
  place_id: z.string().uuid(),
});

// ─── Saved places ─────────────────────────────────────────────────────────────

export const SavedPlaceSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  address: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  category: z.string().nullable(),
  osm_id: z.string().nullable(),
  created_at: z.string().datetime(),
});

export const AddSavedPlaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  category: z.string().max(100).optional(),
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const EmailAuthSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// ─── Exported types ───────────────────────────────────────────────────────────

export type Profile = z.infer<typeof ProfileSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type CreateGroup = z.infer<typeof CreateGroupSchema>;
export type Ping = z.infer<typeof PingSchema>;
export type PingStatus = z.infer<typeof PingStatusSchema>;
export type CreatePing = z.infer<typeof CreatePingSchema>;
export type Rsvp = z.infer<typeof RsvpSchema>;
export type RsvpStatus = z.infer<typeof RsvpStatusSchema>;
export type UpsertRsvp = z.infer<typeof UpsertRsvpSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type PlaceSource = z.infer<typeof PlaceSourceSchema>;
export type SuggestPlace = z.infer<typeof SuggestPlaceSchema>;
export type Vote = z.infer<typeof VoteSchema>;
export type CastVote = z.infer<typeof CastVoteSchema>;
export type SavedPlace = z.infer<typeof SavedPlaceSchema>;
export type AddSavedPlace = z.infer<typeof AddSavedPlaceSchema>;
export type EmailAuth = z.infer<typeof EmailAuthSchema>;
