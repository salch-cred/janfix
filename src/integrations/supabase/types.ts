export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      assignment_rules: {
        Row: {
          active: boolean;
          authority_id: number;
          category_id: number;
          created_at: string;
          id: number;
          representative_id: number | null;
          version: number;
          ward_id: number | null;
        };
        Insert: {
          active?: boolean;
          authority_id: number;
          category_id: number;
          created_at?: string;
          id?: never;
          representative_id?: number | null;
          version?: number;
          ward_id?: number | null;
        };
        Update: {
          active?: boolean;
          authority_id?: number;
          category_id?: number;
          created_at?: string;
          id?: never;
          representative_id?: number | null;
          version?: number;
          ward_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_rules_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_rules_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_rules_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_rules_ward_id_fkey";
            columns: ["ward_id"];
            isOneToOne: false;
            referencedRelation: "wards";
            referencedColumns: ["id"];
          },
        ];
      };
      authorities: {
        Row: {
          address: string | null;
          created_at: string;
          department: string | null;
          email: string | null;
          id: number;
          jurisdiction: string | null;
          logo_url: string | null;
          name: string;
          phone: string | null;
          photo_url: string | null;
          type: string | null;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          id?: never;
          jurisdiction?: string | null;
          logo_url?: string | null;
          name: string;
          phone?: string | null;
          photo_url?: string | null;
          type?: string | null;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          id?: never;
          jurisdiction?: string | null;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          photo_url?: string | null;
          type?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          color: string | null;
          icon: string | null;
          id: number;
          name_en: string;
          name_kn: string | null;
          slug: string;
          sort_order: number | null;
        };
        Insert: {
          color?: string | null;
          icon?: string | null;
          id?: never;
          name_en: string;
          name_kn?: string | null;
          slug: string;
          sort_order?: number | null;
        };
        Update: {
          color?: string | null;
          icon?: string | null;
          id?: never;
          name_en?: string;
          name_kn?: string | null;
          slug?: string;
          sort_order?: number | null;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          device_id: string;
          first_seen: string;
          last_seen: string;
          report_count: number;
          trusted_at: string | null;
        };
        Insert: {
          device_id: string;
          first_seen?: string;
          last_seen?: string;
          report_count?: number;
          trusted_at?: string | null;
        };
        Update: {
          device_id?: string;
          first_seen?: string;
          last_seen?: string;
          report_count?: number;
          trusted_at?: string | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          created_at: string;
          device_id: string | null;
          email: string | null;
          id: string;
          message: string;
          name: string | null;
          page_url: string | null;
          read_at: string | null;
        };
        Insert: {
          created_at?: string;
          device_id?: string | null;
          email?: string | null;
          id?: string;
          message: string;
          name?: string | null;
          page_url?: string | null;
          read_at?: string | null;
        };
        Update: {
          created_at?: string;
          device_id?: string | null;
          email?: string | null;
          id?: string;
          message?: string;
          name?: string | null;
          page_url?: string | null;
          read_at?: string | null;
        };
        Relationships: [];
      };
      gram_panchayats: {
        Row: {
          id: number;
          name: string;
          taluk_id: number | null;
        };
        Insert: {
          id?: never;
          name: string;
          taluk_id?: number | null;
        };
        Update: {
          id?: never;
          name?: string;
          taluk_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "gram_panchayats_taluk_id_fkey";
            columns: ["taluk_id"];
            isOneToOne: false;
            referencedRelation: "taluks";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_comments: {
        Row: {
          body: string;
          created_at: string;
          device_id: string | null;
          hidden: boolean;
          id: string;
          issue_id: string;
          name: string | null;
          quick_reply: Database["public"]["Enums"]["quick_reply"] | null;
        };
        Insert: {
          body: string;
          created_at?: string;
          device_id?: string | null;
          hidden?: boolean;
          id?: string;
          issue_id: string;
          name?: string | null;
          quick_reply?: Database["public"]["Enums"]["quick_reply"] | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          device_id?: string | null;
          hidden?: boolean;
          id?: string;
          issue_id?: string;
          name?: string | null;
          quick_reply?: Database["public"]["Enums"]["quick_reply"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "issue_comments_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_official_updates: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          issue_id: string;
          posted_by: string | null;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          issue_id: string;
          posted_by?: string | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          issue_id?: string;
          posted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "issue_official_updates_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_photos: {
        Row: {
          created_at: string;
          id: string;
          issue_id: string;
          path: string | null;
          position: number;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          issue_id: string;
          path?: string | null;
          position?: number;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          issue_id?: string;
          path?: string | null;
          position?: number;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "issue_photos_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_status_history: {
        Row: {
          by_admin: boolean;
          by_device_id: string | null;
          created_at: string;
          id: string;
          issue_id: string;
          note: string | null;
          photo_kind: Database["public"]["Enums"]["photo_kind"] | null;
          photo_url: string | null;
          status: Database["public"]["Enums"]["issue_status"] | null;
        };
        Insert: {
          by_admin?: boolean;
          by_device_id?: string | null;
          created_at?: string;
          id?: string;
          issue_id: string;
          note?: string | null;
          photo_kind?: Database["public"]["Enums"]["photo_kind"] | null;
          photo_url?: string | null;
          status?: Database["public"]["Enums"]["issue_status"] | null;
        };
        Update: {
          by_admin?: boolean;
          by_device_id?: string | null;
          created_at?: string;
          id?: string;
          issue_id?: string;
          note?: string | null;
          photo_kind?: Database["public"]["Enums"]["photo_kind"] | null;
          photo_url?: string | null;
          status?: Database["public"]["Enums"]["issue_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "issue_status_history_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_supporters: {
        Row: {
          created_at: string;
          device_id: string;
          issue_id: string;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          issue_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          issue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "issue_supporters_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_thanks: {
        Row: {
          created_at: string;
          device_id: string;
          issue_id: string;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          issue_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          issue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "issue_thanks_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_votes: {
        Row: {
          created_at: string;
          device_id: string;
          issue_id: string;
          vote: Database["public"]["Enums"]["vote_kind"];
        };
        Insert: {
          created_at?: string;
          device_id: string;
          issue_id: string;
          vote: Database["public"]["Enums"]["vote_kind"];
        };
        Update: {
          created_at?: string;
          device_id?: string;
          issue_id?: string;
          vote?: Database["public"]["Enums"]["vote_kind"];
        };
        Relationships: [
          {
            foreignKeyName: "issue_votes_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      issue_watchers: {
        Row: {
          created_at: string;
          device_id: string;
          email: string | null;
          issue_id: string;
          phone: string | null;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          email?: string | null;
          issue_id: string;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          email?: string | null;
          issue_id?: string;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "issue_watchers_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
      issues: {
        Row: {
          address: string | null;
          area: string | null;
          assigned_authority_id: number | null;
          assigned_representative_id: number | null;
          assignment_reason: string | null;
          assignment_rule_version: number | null;
          category_id: number;
          created_at: string;
          description: string;
          device_id: string | null;
          duplicate_count: number;
          duplicate_of_id: string | null;
          heat_score: number;
          id: string;
          image_phash: string | null;
          image_url: string | null;
          jurisdiction_confidence: string | null;
          lat: number;
          lng: number;
          locality: string | null;
          needs_review: boolean;
          pincode: string | null;
          public_id: string;
          severity: Database["public"]["Enums"]["issue_severity"];
          slug: string | null;
          status: Database["public"]["Enums"]["issue_status"];
          supporters_count: number;
          thanked_count: number;
          updated_at: string;
          views: number;
          visibility: Database["public"]["Enums"]["issue_visibility"];
          ward_id: number | null;
        };
        Insert: {
          address?: string | null;
          area?: string | null;
          assigned_authority_id?: number | null;
          assigned_representative_id?: number | null;
          assignment_reason?: string | null;
          assignment_rule_version?: number | null;
          category_id: number;
          created_at?: string;
          description: string;
          device_id?: string | null;
          duplicate_count?: number;
          duplicate_of_id?: string | null;
          heat_score?: number;
          id?: string;
          image_phash?: string | null;
          image_url?: string | null;
          jurisdiction_confidence?: string | null;
          lat: number;
          lng: number;
          locality?: string | null;
          needs_review?: boolean;
          pincode?: string | null;
          public_id: string;
          severity?: Database["public"]["Enums"]["issue_severity"];
          slug?: string | null;
          status?: Database["public"]["Enums"]["issue_status"];
          supporters_count?: number;
          thanked_count?: number;
          updated_at?: string;
          views?: number;
          visibility?: Database["public"]["Enums"]["issue_visibility"];
          ward_id?: number | null;
        };
        Update: {
          address?: string | null;
          area?: string | null;
          assigned_authority_id?: number | null;
          assigned_representative_id?: number | null;
          assignment_reason?: string | null;
          assignment_rule_version?: number | null;
          category_id?: number;
          created_at?: string;
          description?: string;
          device_id?: string | null;
          duplicate_count?: number;
          duplicate_of_id?: string | null;
          heat_score?: number;
          id?: string;
          image_phash?: string | null;
          image_url?: string | null;
          jurisdiction_confidence?: string | null;
          lat?: number;
          lng?: number;
          locality?: string | null;
          needs_review?: boolean;
          pincode?: string | null;
          public_id?: string;
          severity?: Database["public"]["Enums"]["issue_severity"];
          slug?: string | null;
          status?: Database["public"]["Enums"]["issue_status"];
          supporters_count?: number;
          thanked_count?: number;
          updated_at?: string;
          views?: number;
          visibility?: Database["public"]["Enums"]["issue_visibility"];
          ward_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "issues_assigned_authority_id_fkey";
            columns: ["assigned_authority_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "issues_assigned_representative_id_fkey";
            columns: ["assigned_representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "issues_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "issues_duplicate_of_id_fkey";
            columns: ["duplicate_of_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "issues_ward_id_fkey";
            columns: ["ward_id"];
            isOneToOne: false;
            referencedRelation: "wards";
            referencedColumns: ["id"];
          },
        ];
      };
      jurisdiction_rules: {
        Row: {
          active: boolean;
          authority_id: number | null;
          category_id: number;
          confidence: string;
          created_at: string;
          id: number;
          notes: string | null;
          priority: number;
          scope_type: string;
          taluk_id: number | null;
        };
        Insert: {
          active?: boolean;
          authority_id?: number | null;
          category_id: number;
          confidence?: string;
          created_at?: string;
          id?: never;
          notes?: string | null;
          priority?: number;
          scope_type: string;
          taluk_id?: number | null;
        };
        Update: {
          active?: boolean;
          authority_id?: number | null;
          category_id?: number;
          confidence?: string;
          created_at?: string;
          id?: never;
          notes?: string | null;
          priority?: number;
          scope_type?: string;
          taluk_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "jurisdiction_rules_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jurisdiction_rules_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jurisdiction_rules_taluk_id_fkey";
            columns: ["taluk_id"];
            isOneToOne: false;
            referencedRelation: "taluks";
            referencedColumns: ["id"];
          },
        ];
      };
      representatives: {
        Row: {
          active: boolean;
          authority_id: number | null;
          city: string | null;
          constituency: string | null;
          created_at: string;
          email: string | null;
          id: number;
          name: string;
          phone: string | null;
          photo_url: string | null;
          role: string;
          ward_id: number | null;
        };
        Insert: {
          active?: boolean;
          authority_id?: number | null;
          city?: string | null;
          constituency?: string | null;
          created_at?: string;
          email?: string | null;
          id?: never;
          name: string;
          phone?: string | null;
          photo_url?: string | null;
          role: string;
          ward_id?: number | null;
        };
        Update: {
          active?: boolean;
          authority_id?: number | null;
          city?: string | null;
          constituency?: string | null;
          created_at?: string;
          email?: string | null;
          id?: never;
          name?: string;
          phone?: string | null;
          photo_url?: string | null;
          role?: string;
          ward_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "representatives_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "representatives_ward_id_fkey";
            columns: ["ward_id"];
            isOneToOne: false;
            referencedRelation: "wards";
            referencedColumns: ["id"];
          },
        ];
      };
      road_segments: {
        Row: {
          id: number;
          name: string;
          notes: string | null;
          owner_authority_id: number | null;
          owner_type: string;
          taluk_id: number | null;
        };
        Insert: {
          id?: never;
          name: string;
          notes?: string | null;
          owner_authority_id?: number | null;
          owner_type: string;
          taluk_id?: number | null;
        };
        Update: {
          id?: never;
          name?: string;
          notes?: string | null;
          owner_authority_id?: number | null;
          owner_type?: string;
          taluk_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "road_segments_owner_authority_id_fkey";
            columns: ["owner_authority_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "road_segments_taluk_id_fkey";
            columns: ["taluk_id"];
            isOneToOne: false;
            referencedRelation: "taluks";
            referencedColumns: ["id"];
          },
        ];
      };
      taluks: {
        Row: {
          id: number;
          name: string;
          sub_division: string | null;
        };
        Insert: {
          id?: never;
          name: string;
          sub_division?: string | null;
        };
        Update: {
          id?: never;
          name?: string;
          sub_division?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wards: {
        Row: {
          area: string | null;
          id: number;
          name: string;
          number: number;
        };
        Insert: {
          area?: string | null;
          id?: never;
          name: string;
          number: number;
        };
        Update: {
          area?: string | null;
          id?: never;
          name?: string;
          number?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      next_public_id: { Args: never; Returns: string };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
    };
    Enums: {
      app_role: "admin" | "moderator";
      issue_severity: "low" | "medium" | "high" | "dangerous";
      issue_status:
        | "reported"
        | "community_verified"
        | "assigned"
        | "work_started"
        | "resolved"
        | "community_confirmed"
        | "closed";
      issue_visibility: "visible" | "hidden" | "duplicate" | "spam";
      photo_kind: "report" | "repair" | "citizen_after";
      quick_reply: "also_saw" | "still_exists" | "already_fixed" | "other";
      vote_kind: "exists" | "fixed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator"],
      issue_severity: ["low", "medium", "high", "dangerous"],
      issue_status: [
        "reported",
        "community_verified",
        "assigned",
        "work_started",
        "resolved",
        "community_confirmed",
        "closed",
      ],
      issue_visibility: ["visible", "hidden", "duplicate", "spam"],
      photo_kind: ["report", "repair", "citizen_after"],
      quick_reply: ["also_saw", "still_exists", "already_fixed", "other"],
      vote_kind: ["exists", "fixed"],
    },
  },
} as const;
