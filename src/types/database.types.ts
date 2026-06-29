export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pings: {
        Row: {
          confirmed_place_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          group_id: string
          id: string
          message: string
          proposed_time: string | null
          status: string
        }
        Insert: {
          confirmed_place_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          group_id: string
          id?: string
          message: string
          proposed_time?: string | null
          status?: string
        }
        Update: {
          confirmed_place_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          group_id?: string
          id?: string
          message?: string
          proposed_time?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pings_confirmed_place_id_fkey"
            columns: ["confirmed_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          external_id: string | null
          id: string
          latitude: number
          longitude: number
          name: string
          photo_url: string | null
          ping_id: string
          rating: number | null
          source: string
          suggested_by: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
          photo_url?: string | null
          ping_id: string
          rating?: number | null
          source: string
          suggested_by?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          photo_url?: string | null
          ping_id?: string
          rating?: number | null
          source?: string
          suggested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_ping_id_fkey"
            columns: ["ping_id"]
            isOneToOne: false
            referencedRelation: "pings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          id: string
          latitude: number | null
          location_updated_at: string | null
          longitude: number | null
          ping_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          ping_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          ping_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_ping_id_fkey"
            columns: ["ping_id"]
            isOneToOne: false
            referencedRelation: "pings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_places: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          osm_id: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          osm_id?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          osm_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_places_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          id: string
          ping_id: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ping_id: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ping_id?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_ping_id_fkey"
            columns: ["ping_id"]
            isOneToOne: false
            referencedRelation: "pings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_expired_pings: { Args: never; Returns: undefined }
      delete_user: { Args: never; Returns: undefined }
      is_group_member: { Args: { gid: string }; Returns: boolean }
      lookup_group_by_invite_code: {
        Args: { code: string }
        Returns: {
          description: string
          id: string
          name: string
        }[]
      }
      nullify_terminal_ping_locations: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
