/**
 * Auto-generated Supabase database types.
 * Regenerate with: npx supabase gen types typescript --linked > src/types/database.types.ts
 * Never edit this file by hand.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android';
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android';
          updated_at?: string;
        };
        Update: {
          token?: string;
          platform?: 'ios' | 'android';
          updated_at?: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          avatar_url: string | null;
          created_by: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          avatar_url?: string | null;
          created_by: string;
          invite_code: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          avatar_url?: string | null;
        };
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: 'admin' | 'member';
          joined_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: 'admin' | 'member';
          joined_at?: string;
        };
        Update: {
          role?: 'admin' | 'member';
        };
      };
      pings: {
        Row: {
          id: string;
          group_id: string;
          created_by: string;
          message: string;
          proposed_time: string | null;
          status: 'open' | 'voting' | 'confirmed' | 'cancelled';
          confirmed_place_id: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          created_by: string;
          message: string;
          proposed_time?: string | null;
          status?: 'open' | 'voting' | 'confirmed' | 'cancelled';
          confirmed_place_id?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          message?: string;
          proposed_time?: string | null;
          status?: 'open' | 'voting' | 'confirmed' | 'cancelled';
          confirmed_place_id?: string | null;
        };
      };
      rsvps: {
        Row: {
          id: string;
          ping_id: string;
          user_id: string;
          status: 'in' | 'out' | 'maybe';
          latitude: number | null;
          longitude: number | null;
          location_updated_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ping_id: string;
          user_id: string;
          status: 'in' | 'out' | 'maybe';
          latitude?: number | null;
          longitude?: number | null;
          location_updated_at?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: 'in' | 'out' | 'maybe';
          latitude?: number | null;
          longitude?: number | null;
          location_updated_at?: string | null;
          updated_at?: string;
        };
      };
      places: {
        Row: {
          id: string;
          ping_id: string;
          name: string;
          address: string | null;
          latitude: number;
          longitude: number;
          category: string | null;
          source: 'google_places' | 'manual';
          external_id: string | null;
          photo_url: string | null;
          rating: number | null;
          suggested_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ping_id: string;
          name: string;
          address?: string | null;
          latitude: number;
          longitude: number;
          category?: string | null;
          source: 'google_places' | 'manual';
          external_id?: string | null;
          photo_url?: string | null;
          rating?: number | null;
          suggested_by?: string | null;
          created_at?: string;
        };
        Update: never;
      };
      votes: {
        Row: {
          id: string;
          ping_id: string;
          place_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ping_id: string;
          place_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          place_id?: string;
        };
      };
      saved_places: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          address: string | null;
          latitude: number;
          longitude: number;
          category: string | null;
          google_place_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          address?: string | null;
          latitude: number;
          longitude: number;
          category?: string | null;
          google_place_id?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
          category?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
