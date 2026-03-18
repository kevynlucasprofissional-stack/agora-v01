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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_responses: {
        Row: {
          agent_id: string
          analysis_request_id: string
          content: Json | null
          content_text: string | null
          created_at: string
          error_message: string | null
          id: number
          latency_ms: number | null
          model_name: string | null
          response_format: Database["public"]["Enums"]["response_format"]
          success: boolean
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          agent_id: string
          analysis_request_id: string
          content?: Json | null
          content_text?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          latency_ms?: number | null
          model_name?: string | null
          response_format?: Database["public"]["Enums"]["response_format"]
          success?: boolean
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          agent_id?: string
          analysis_request_id?: string
          content?: Json | null
          content_text?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          latency_ms?: number | null
          model_name?: string | null
          response_format?: Database["public"]["Enums"]["response_format"]
          success?: boolean
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_responses_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_responses_analysis_request_id_fkey"
            columns: ["analysis_request_id"]
            isOneToOne: false
            referencedRelation: "analysis_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          code: Database["public"]["Enums"]["agent_kind"]
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          system_prompt: string | null
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["agent_kind"]
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          system_prompt?: string | null
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["agent_kind"]
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          system_prompt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      analysis_feedback: {
        Row: {
          agent_response_id: number | null
          analysis_request_id: string
          comment: string | null
          created_at: string
          feedback: Database["public"]["Enums"]["feedback_type"]
          id: string
          user_id: string
        }
        Insert: {
          agent_response_id?: number | null
          analysis_request_id: string
          comment?: string | null
          created_at?: string
          feedback: Database["public"]["Enums"]["feedback_type"]
          id?: string
          user_id: string
        }
        Update: {
          agent_response_id?: number | null
          analysis_request_id?: string
          comment?: string | null
          created_at?: string
          feedback?: Database["public"]["Enums"]["feedback_type"]
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_feedback_agent_response_id_fkey"
            columns: ["agent_response_id"]
            isOneToOne: false
            referencedRelation: "agent_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_feedback_analysis_request_id_fkey"
            columns: ["analysis_request_id"]
            isOneToOne: false
            referencedRelation: "analysis_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_requests: {
        Row: {
          clarification_questions: Json | null
          completed_at: string | null
          created_at: string
          declared_target_audience: string | null
          enterprise_id: string | null
          id: string
          industry: string | null
          metrics_snapshot: Json | null
          missing_variables: Json | null
          normalized_payload: Json | null
          primary_channel: string | null
          raw_prompt: string
          region: string | null
          score_offer: number | null
          score_overall: number | null
          score_performance: number | null
          score_sociobehavioral: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["analysis_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clarification_questions?: Json | null
          completed_at?: string | null
          created_at?: string
          declared_target_audience?: string | null
          enterprise_id?: string | null
          id?: string
          industry?: string | null
          metrics_snapshot?: Json | null
          missing_variables?: Json | null
          normalized_payload?: Json | null
          primary_channel?: string | null
          raw_prompt: string
          region?: string | null
          score_offer?: number | null
          score_overall?: number | null
          score_performance?: number | null
          score_sociobehavioral?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clarification_questions?: Json | null
          completed_at?: string | null
          created_at?: string
          declared_target_audience?: string | null
          enterprise_id?: string | null
          id?: string
          industry?: string | null
          metrics_snapshot?: Json | null
          missing_variables?: Json | null
          normalized_payload?: Json | null
          primary_channel?: string | null
          raw_prompt?: string
          region?: string | null
          score_offer?: number | null
          score_overall?: number | null
          score_performance?: number | null
          score_sociobehavioral?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_requests_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          analysis_request_id: string | null
          context_type: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_request_id?: string | null
          context_type?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_request_id?: string | null
          context_type?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_analysis_request_id_fkey"
            columns: ["analysis_request_id"]
            isOneToOne: false
            referencedRelation: "analysis_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_jobs: {
        Row: {
          analysis_request_id: string
          conversation_id: string | null
          created_at: string
          editable_html: string | null
          format: string | null
          id: string
          image_url: string | null
          layers_state: Json | null
          prompt_context: Json | null
          status: string
          strategist_output: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_request_id: string
          conversation_id?: string | null
          created_at?: string
          editable_html?: string | null
          format?: string | null
          id?: string
          image_url?: string | null
          layers_state?: Json | null
          prompt_context?: Json | null
          status?: string
          strategist_output?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_request_id?: string
          conversation_id?: string | null
          created_at?: string
          editable_html?: string | null
          format?: string | null
          id?: string
          image_url?: string | null
          layers_state?: Json | null
          prompt_context?: Json | null
          status?: string
          strategist_output?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_jobs_analysis_request_id_fkey"
            columns: ["analysis_request_id"]
            isOneToOne: false
            referencedRelation: "analysis_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usage_counters: {
        Row: {
          analyses_count: number
          created_at: string
          id: string
          updated_at: string
          uploads_count: number
          usage_date: string
          user_id: string
        }
        Insert: {
          analyses_count?: number
          created_at?: string
          id?: string
          updated_at?: string
          uploads_count?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          analyses_count?: number
          created_at?: string
          id?: string
          updated_at?: string
          uploads_count?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_usage_counters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_members: {
        Row: {
          created_at: string
          enterprise_id: string
          id: string
          is_admin: boolean
          member_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enterprise_id: string
          id?: string
          is_admin?: boolean
          member_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enterprise_id?: string
          id?: string
          is_admin?: boolean
          member_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_members_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprises: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_integrations: {
        Row: {
          created_at: string
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          enterprise_id: string | null
          expires_at: string | null
          external_account_id: string | null
          id: string
          metadata: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          enterprise_id?: string | null
          expires_at?: string | null
          external_account_id?: string | null
          id?: string
          metadata?: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          enterprise_id?: string | null
          expires_at?: string | null
          external_account_id?: string | null
          id?: string
          metadata?: Json
          provider?: Database["public"]["Enums"]["integration_provider"]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_integrations_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          analysis_request_id: string | null
          bucket_name: string
          created_at: string
          enterprise_id: string | null
          extracted_text: string | null
          file_size_bytes: number | null
          id: string
          kind: Database["public"]["Enums"]["upload_kind"]
          metadata: Json
          mime_type: string
          original_filename: string
          storage_path: string
          user_id: string
        }
        Insert: {
          analysis_request_id?: string | null
          bucket_name?: string
          created_at?: string
          enterprise_id?: string | null
          extracted_text?: string | null
          file_size_bytes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["upload_kind"]
          metadata?: Json
          mime_type: string
          original_filename: string
          storage_path: string
          user_id: string
        }
        Update: {
          analysis_request_id?: string | null
          bucket_name?: string
          created_at?: string
          enterprise_id?: string | null
          extracted_text?: string | null
          file_size_bytes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["upload_kind"]
          metadata?: Json
          mime_type?: string
          original_filename?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_analysis_request_id_fkey"
            columns: ["analysis_request_id"]
            isOneToOne: false
            referencedRelation: "analysis_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_enterprise_id_fkey"
            columns: ["enterprise_id"]
            isOneToOne: false
            referencedRelation: "enterprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_outputs: {
        Row: {
          agent_id: string | null
          analysis_request_id: string
          content_markdown: string | null
          created_at: string
          external_url: string | null
          file_url: string | null
          id: string
          metadata: Json
          output_type: string
          title: string | null
        }
        Insert: {
          agent_id?: string | null
          analysis_request_id: string
          content_markdown?: string | null
          created_at?: string
          external_url?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json
          output_type: string
          title?: string | null
        }
        Update: {
          agent_id?: string | null
          analysis_request_id?: string
          content_markdown?: string | null
          created_at?: string
          external_url?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json
          output_type?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_outputs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_outputs_analysis_request_id_fkey"
            columns: ["analysis_request_id"]
            isOneToOne: false
            referencedRelation: "analysis_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          advanced_templates_enabled: boolean
          code: Database["public"]["Enums"]["plan_code"]
          created_at: string
          description: string | null
          enterprise_integrations_enabled: boolean
          id: number
          is_active: boolean
          name: string
          price_monthly: number
          price_yearly: number | null
          reports_level: string
          synthetic_audience_enabled: boolean
          updated_at: string
          uploads_limit_daily: number
        }
        Insert: {
          advanced_templates_enabled?: boolean
          code: Database["public"]["Enums"]["plan_code"]
          created_at?: string
          description?: string | null
          enterprise_integrations_enabled?: boolean
          id?: number
          is_active?: boolean
          name: string
          price_monthly?: number
          price_yearly?: number | null
          reports_level?: string
          synthetic_audience_enabled?: boolean
          updated_at?: string
          uploads_limit_daily: number
        }
        Update: {
          advanced_templates_enabled?: boolean
          code?: Database["public"]["Enums"]["plan_code"]
          created_at?: string
          description?: string | null
          enterprise_integrations_enabled?: boolean
          id?: number
          is_active?: boolean
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          reports_level?: string
          synthetic_audience_enabled?: boolean
          updated_at?: string
          uploads_limit_daily?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          current_plan_id: number
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          original_plan_id: number | null
          role_title: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          current_plan_id: number
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          original_plan_id?: number | null
          role_title?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          current_plan_id?: number
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          original_plan_id?: number | null
          role_title?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_upload_limit: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      agent_kind:
        | "master_orchestrator"
        | "sociobehavioral"
        | "offer_engineer"
        | "performance_scientist"
        | "chief_strategist"
      analysis_status:
        | "draft"
        | "awaiting_clarification"
        | "processing"
        | "completed"
        | "failed"
        | "archived"
      feedback_type: "like" | "dislike"
      integration_provider:
        | "stripe"
        | "openai"
        | "anthropic"
        | "serper"
        | "ibge"
        | "meta_ads"
        | "ga4"
        | "canva"
        | "gamma"
      integration_status: "disconnected" | "pending" | "connected" | "error"
      plan_code: "freemium" | "standard" | "pro" | "enterprise"
      response_format: "json" | "markdown" | "text"
      upload_kind:
        | "user_input"
        | "analysis_attachment"
        | "generated_report"
        | "generated_asset"
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
  public: {
    Enums: {
      agent_kind: [
        "master_orchestrator",
        "sociobehavioral",
        "offer_engineer",
        "performance_scientist",
        "chief_strategist",
      ],
      analysis_status: [
        "draft",
        "awaiting_clarification",
        "processing",
        "completed",
        "failed",
        "archived",
      ],
      feedback_type: ["like", "dislike"],
      integration_provider: [
        "stripe",
        "openai",
        "anthropic",
        "serper",
        "ibge",
        "meta_ads",
        "ga4",
        "canva",
        "gamma",
      ],
      integration_status: ["disconnected", "pending", "connected", "error"],
      plan_code: ["freemium", "standard", "pro", "enterprise"],
      response_format: ["json", "markdown", "text"],
      upload_kind: [
        "user_input",
        "analysis_attachment",
        "generated_report",
        "generated_asset",
      ],
    },
  },
} as const
