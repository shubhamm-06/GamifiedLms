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
  public: {
    Tables: {
      app_settings: {
        Row: {
          default_currency: string
          id: string
          privacy_url: string | null
          quiz_pass_threshold_percent: number
          site_name: string
          site_url: string | null
          support_email: string | null
          terms_url: string | null
        }
        Insert: {
          default_currency?: string
          id?: string
          privacy_url?: string | null
          quiz_pass_threshold_percent?: number
          site_name?: string
          site_url?: string | null
          support_email?: string | null
          terms_url?: string | null
        }
        Update: {
          default_currency?: string
          id?: string
          privacy_url?: string | null
          quiz_pass_threshold_percent?: number
          site_name?: string
          site_url?: string | null
          support_email?: string | null
          terms_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_default_currency_fkey"
            columns: ["default_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      badges: {
        Row: {
          condition_type: string
          condition_value: number
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          condition_type: string
          condition_value: number
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          condition_type?: string
          condition_value?: number
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "badges_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          access_duration_days: number | null
          access_type: string
          created_at: string
          created_by: string | null
          currency: string
          default_lesson_xp: number
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          enrollment_status: string
          external_product_id: string | null
          gamification_enabled: boolean
          id: string
          is_free: boolean
          price_amount: number | null
          published_at: string | null
          slug: string
          status: string
          subtitle: string | null
          thumbnail_url: string | null
          title: string
          total_lessons: number
          total_students: number
          updated_at: string
        }
        Insert: {
          access_duration_days?: number | null
          access_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          default_lesson_xp?: number
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          enrollment_status?: string
          external_product_id?: string | null
          gamification_enabled?: boolean
          id?: string
          is_free?: boolean
          price_amount?: number | null
          published_at?: string | null
          slug: string
          status?: string
          subtitle?: string | null
          thumbnail_url?: string | null
          title: string
          total_lessons?: number
          total_students?: number
          updated_at?: string
        }
        Update: {
          access_duration_days?: number | null
          access_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          default_lesson_xp?: number
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          enrollment_status?: string
          external_product_id?: string | null
          gamification_enabled?: boolean
          id?: string
          is_free?: boolean
          price_amount?: number | null
          published_at?: string | null
          slug?: string
          status?: string
          subtitle?: string | null
          thumbnail_url?: string | null
          title?: string
          total_lessons?: number
          total_students?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          payment_id: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          payment_id?: string | null
          source: string
          status?: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          payment_id?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          bundle_size_bytes: number
          bundle_url: string
          bundle_version: string
          checksum: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          max_xp: number
          orientation: string
          slug: string
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          bundle_size_bytes: number
          bundle_url: string
          bundle_version: string
          checksum: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          max_xp?: number
          orientation?: string
          slug: string
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          bundle_size_bytes?: number
          bundle_url?: string
          bundle_version?: string
          checksum?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          max_xp?: number
          orientation?: string
          slug?: string
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content_blocks: {
        Row: {
          block_type: string
          callout_color: string | null
          callout_icon: string | null
          created_at: string
          id: string
          image_alt: string | null
          image_url: string | null
          lesson_id: string
          position: number
          text_content: string | null
          updated_at: string
        }
        Insert: {
          block_type: string
          callout_color?: string | null
          callout_icon?: string | null
          created_at?: string
          id?: string
          image_alt?: string | null
          image_url?: string | null
          lesson_id: string
          position?: number
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          block_type?: string
          callout_color?: string | null
          callout_icon?: string | null
          created_at?: string
          id?: string
          image_alt?: string | null
          image_url?: string | null
          lesson_id?: string
          position?: number
          text_content?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_content_blocks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_effective_xp"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_content_blocks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          active_seconds: number
          completed_at: string | null
          course_id: string
          first_opened_at: string | null
          id: string
          last_heartbeat_at: string | null
          lesson_id: string
          progress_percent: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_seconds?: number
          completed_at?: string | null
          course_id: string
          first_opened_at?: string | null
          id?: string
          last_heartbeat_at?: string | null
          lesson_id: string
          progress_percent?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_seconds?: number
          completed_at?: string | null
          course_id?: string
          first_opened_at?: string | null
          id?: string
          last_heartbeat_at?: string | null
          lesson_id?: string
          progress_percent?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_effective_xp"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content_html: string | null
          content_type: string
          course_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          duration_seconds: number | null
          game_id: string | null
          id: string
          is_preview: boolean
          min_time_seconds: number
          module_id: string | null
          pass_percentage: number
          position: number
          status: string
          summary: string | null
          title: string
          video_url: string | null
          xp_reward: number | null
        }
        Insert: {
          content_html?: string | null
          content_type: string
          course_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          duration_seconds?: number | null
          game_id?: string | null
          id?: string
          is_preview?: boolean
          min_time_seconds?: number
          module_id?: string | null
          pass_percentage?: number
          position: number
          status?: string
          summary?: string | null
          title: string
          video_url?: string | null
          xp_reward?: number | null
        }
        Update: {
          content_html?: string | null
          content_type?: string
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          duration_seconds?: number | null
          game_id?: string | null
          id?: string
          is_preview?: boolean
          min_time_seconds?: number
          module_id?: string | null
          pass_percentage?: number
          position?: number
          status?: string
          summary?: string | null
          title?: string
          video_url?: string | null
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      level_thresholds: {
        Row: {
          level: number
          xp_required: number
        }
        Insert: {
          level: number
          xp_required: number
        }
        Update: {
          level?: number
          xp_required?: number
        }
        Relationships: []
      }
      manual_order_providers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          position: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          position: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          course_id: string
          currency: string
          deleted_at: string | null
          email: string
          id: string
          provider: string
          provider_payment_id: string
          raw_payload: Json
          received_at: string
          reconciliation_note: string | null
          reconciliation_status: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount: number
          course_id: string
          currency?: string
          deleted_at?: string | null
          email: string
          id?: string
          provider: string
          provider_payment_id: string
          raw_payload: Json
          received_at?: string
          reconciliation_note?: string | null
          reconciliation_status?: string
          status: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          course_id?: string
          currency?: string
          deleted_at?: string | null
          email?: string
          id?: string
          provider?: string
          provider_payment_id?: string
          raw_payload?: Json
          received_at?: string
          reconciliation_note?: string | null
          reconciliation_status?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          display_name: string
          email: string
          id: string
          phone_number: string | null
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          display_name: string
          email: string
          id: string
          phone_number?: string | null
          role?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          display_name?: string
          email?: string
          id?: string
          phone_number?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          attempted_at: string
          id: string
          lesson_id: string
          max_score: number
          passed: boolean
          score: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempted_at?: string
          id?: string
          lesson_id: string
          max_score: number
          passed: boolean
          score: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempted_at?: string
          id?: string
          lesson_id?: string
          max_score?: number
          passed?: boolean
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_effective_xp"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "quiz_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_option: string
          explanation: string | null
          id: string
          lesson_id: string
          options: Json
          position: number
          prompt: string
        }
        Insert: {
          correct_option: string
          explanation?: string | null
          id?: string
          lesson_id: string
          options: Json
          position: number
          prompt: string
        }
        Update: {
          correct_option?: string
          explanation?: string | null
          id?: string
          lesson_id?: string
          options?: Json
          position?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_effective_xp"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          current_streak: number
          last_activity_date: string | null
          lessons_completed: number
          level: number
          longest_streak: number
          total_xp: number
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_activity_date?: string | null
          lessons_completed?: number
          level?: number
          longest_streak?: number
          total_xp?: number
          user_id: string
        }
        Update: {
          current_streak?: number
          last_activity_date?: string | null
          lessons_completed?: number
          level?: number
          longest_streak?: number
          total_xp?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          source_id?: string | null
          source_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      lesson_effective_xp: {
        Row: {
          effective_xp: number | null
          lesson_id: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      quiz_questions_public: {
        Row: {
          id: string | null
          lesson_id: string | null
          options: Json | null
          position: number | null
          prompt: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_effective_xp"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fn_admin_course_progress_summary: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: {
          lessons_completed: number
          progress_rows: number
          quiz_attempts: number
          xp_to_claw_back: number
        }[]
      }
      fn_admin_reset_course_progress: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: {
          lessons_removed: number
          quiz_attempts_removed: number
          xp_clawed_back: number
        }[]
      }
      fn_caller_enrolled: { Args: { p_course_id: string }; Returns: boolean }
      fn_caller_lesson_unlocked: {
        Args: { p_lesson_id: string }
        Returns: boolean
      }
      fn_check_quiz_answer: {
        Args: { p_lesson_id: string; p_option_id: string; p_question_id: string }
        Returns: { correct: boolean; correct_option: string }[]
      }
      fn_complete_lesson: {
        Args: { p_lesson_id: string }
        Returns: {
          already_completed: boolean
          completed: boolean
          completed_at: string
          xp_awarded: number
        }[]
      }
      fn_compute_level: { Args: { p_total_xp: number }; Returns: number }
      fn_course_delete_blockers: {
        Args: { p_course_id: string }
        Returns: {
          enrollment_count: number
          lesson_progress_count: number
          payment_count: number
          quiz_attempt_count: number
          xp_transaction_count: number
        }[]
      }
      fn_course_is_live: { Args: { p_course_id: string }; Returns: boolean }
      fn_course_lesson_states: {
        Args: { p_course_id: string }
        Returns: {
          active_seconds: number
          completed_at: string
          lesson_id: string
          min_time_seconds: number
          module_id: string
          sort_index: number
          state: string
        }[]
      }
      fn_create_manual_order: {
        Args: {
          p_amount: number
          p_course_id: string
          p_currency: string
          p_note?: string
          p_provider: string
          p_user_id: string
        }
        Returns: string
      }
      fn_delete_module_permanently: {
        Args: { p_module_id: string }
        Returns: number
      }
      fn_engine_complete: {
        Args: { p_course_id: string; p_lesson_id: string; p_user_id: string }
        Returns: {
          completed_at: string
          was_new: boolean
          xp_awarded: number
        }[]
      }
      fn_engine_error: { Args: { p_code: string }; Returns: undefined }
      fn_engine_guard: {
        Args: { p_lesson_id: string }
        Returns: {
          content_type: string
          course_id: string
          min_time_seconds: number
          pass_percentage: number
          state: string
          user_id: string
        }[]
      }
      fn_evaluate_badges: { Args: { p_user_id: string }; Returns: undefined }
      fn_home_course: { Args: never; Returns: string }
      fn_is_admin: { Args: never; Returns: boolean }
      fn_is_enrolled: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: boolean
      }
      fn_lesson_heartbeat: {
        Args: { p_lesson_id: string }
        Returns: {
          active_seconds: number
          completed: boolean
          min_time_seconds: number
          time_met: boolean
        }[]
      }
      fn_lesson_is_live: { Args: { p_lesson_id: string }; Returns: boolean }
      fn_lesson_states: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: {
          active_seconds: number
          completed_at: string
          lesson_id: string
          min_time_seconds: number
          module_id: string
          sort_index: number
          state: string
        }[]
      }
      fn_lesson_unlocked_for: {
        Args: { p_lesson_id: string; p_user_id: string }
        Returns: boolean
      }
      fn_recompute_course_lesson_count: {
        Args: { p_course_id: string }
        Returns: undefined
      }
      fn_restore_blockers: {
        Args: { p_id: string; p_type: string }
        Returns: {
          blocking_id: string
          blocking_title: string
          blocking_type: string
        }[]
      }
      fn_revoke_user_sessions: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      fn_submit_quiz: {
        Args: { p_answers: Json; p_lesson_id: string }
        Returns: {
          completed: boolean
          max_score: number
          passed: boolean
          percentage: number
          results: Json
          score: number
          time_met: boolean
          xp_awarded: number
        }[]
      }
      fn_touch_enrollment: { Args: { p_course_id: string }; Returns: undefined }
      fn_user_is_trashed: { Args: { p_user_id: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
