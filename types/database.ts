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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_groups: {
        Row: {
          account_ids: string[] | null
          created_at: string | null
          description: string | null
          group_name: string
          id: string
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          group_name: string
          id?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          group_name?: string
          id?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      account_nordvpn_assignments: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          last_rotated_at: string | null
          nordvpn_server_id: string
          rotation_enabled: boolean | null
          rotation_interval_hours: number | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          last_rotated_at?: string | null
          nordvpn_server_id: string
          rotation_enabled?: boolean | null
          rotation_interval_hours?: number | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          last_rotated_at?: string | null
          nordvpn_server_id?: string
          rotation_enabled?: boolean | null
          rotation_interval_hours?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_nordvpn_assignments_nordvpn_server_id_fkey"
            columns: ["nordvpn_server_id"]
            isOneToOne: false
            referencedRelation: "nordvpn_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_nordvpn_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      account_tokens: {
        Row: {
          access_token: string
          access_token_secret: string | null
          account_id: string
          account_type: string
          created_at: string | null
          display_name: string | null
          error_message: string | null
          expires_at: string | null
          followers_count: number | null
          following_count: number | null
          id: string
          is_active: boolean | null
          is_suspended: boolean | null
          is_verified: boolean | null
          last_refreshed_at: string | null
          profile_image_url: string | null
          refresh_count: number | null
          refresh_token: string | null
          scope: string | null
          suspended_at: string | null
          suspended_reason: string | null
          token_type: string
          twitter_app_id: string | null
          twitter_display_name: string | null
          updated_at: string | null
          user_id: string
          x_user_id: string
          x_username: string
        }
        Insert: {
          access_token: string
          access_token_secret?: string | null
          account_id: string
          account_type: string
          created_at?: string | null
          display_name?: string | null
          error_message?: string | null
          expires_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          is_active?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_refreshed_at?: string | null
          profile_image_url?: string | null
          refresh_count?: number | null
          refresh_token?: string | null
          scope?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          token_type: string
          twitter_app_id?: string | null
          twitter_display_name?: string | null
          updated_at?: string | null
          user_id: string
          x_user_id: string
          x_username: string
        }
        Update: {
          access_token?: string
          access_token_secret?: string | null
          account_id?: string
          account_type?: string
          created_at?: string | null
          display_name?: string | null
          error_message?: string | null
          expires_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          is_active?: boolean | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_refreshed_at?: string | null
          profile_image_url?: string | null
          refresh_count?: number | null
          refresh_token?: string | null
          scope?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          token_type?: string
          twitter_app_id?: string | null
          twitter_display_name?: string | null
          updated_at?: string | null
          user_id?: string
          x_user_id?: string
          x_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_tokens_twitter_app_id_fkey"
            columns: ["twitter_app_id"]
            isOneToOne: false
            referencedRelation: "twitter_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      analytics: {
        Row: {
          date: string
          dimensions: Json | null
          id: string
          metric_name: string
          metric_type: string
          metric_value: number
          timestamp: string | null
          user_id: string
        }
        Insert: {
          date?: string
          dimensions?: Json | null
          id?: string
          metric_name: string
          metric_type: string
          metric_value: number
          timestamp?: string | null
          user_id: string
        }
        Update: {
          date?: string
          dimensions?: Json | null
          id?: string
          metric_name?: string
          metric_type?: string
          metric_value?: number
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      app_pool_device_accounts: {
        Row: {
          account_id: string
          assigned_at: string | null
          device_id: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          assigned_at?: string | null
          device_id: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string
          assigned_at?: string | null
          device_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_pool_device_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "app_pool_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_pool_device_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      app_pool_devices: {
        Row: {
          created_at: string | null
          device_name: string
          device_type: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          metadata: Json | null
          os_version: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_name: string
          device_type: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          metadata?: Json | null
          os_version?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_name?: string
          device_type?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          metadata?: Json | null
          os_version?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_pool_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          encrypted: boolean | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          encrypted?: boolean | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          encrypted?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      auto_engagement_executions: {
        Row: {
          action_type: string
          actions_attempted: number | null
          actions_failed: number | null
          actions_succeeded: number | null
          error_json: Json | null
          error_message: string | null
          exec_data: Json | null
          executed_at: string | null
          executor_account_id: string
          filtered_count: number | null
          id: string
          metadata: Json | null
          rule_id: string
          searched_count: number | null
          success: boolean
          target_tweet_id: string | null
          target_tweet_ids: string[] | null
          target_user_id: string | null
          target_user_ids: string[] | null
          target_username: string | null
          trace_id: string | null
          used_account_ids: string[] | null
          user_id: string
        }
        Insert: {
          action_type: string
          actions_attempted?: number | null
          actions_failed?: number | null
          actions_succeeded?: number | null
          error_json?: Json | null
          error_message?: string | null
          exec_data?: Json | null
          executed_at?: string | null
          executor_account_id: string
          filtered_count?: number | null
          id?: string
          metadata?: Json | null
          rule_id: string
          searched_count?: number | null
          success: boolean
          target_tweet_id?: string | null
          target_tweet_ids?: string[] | null
          target_user_id?: string | null
          target_user_ids?: string[] | null
          target_username?: string | null
          trace_id?: string | null
          used_account_ids?: string[] | null
          user_id: string
        }
        Update: {
          action_type?: string
          actions_attempted?: number | null
          actions_failed?: number | null
          actions_succeeded?: number | null
          error_json?: Json | null
          error_message?: string | null
          exec_data?: Json | null
          executed_at?: string | null
          executor_account_id?: string
          filtered_count?: number | null
          id?: string
          metadata?: Json | null
          rule_id?: string
          searched_count?: number | null
          success?: boolean
          target_tweet_id?: string | null
          target_tweet_ids?: string[] | null
          target_user_id?: string | null
          target_user_ids?: string[] | null
          target_username?: string | null
          trace_id?: string | null
          used_account_ids?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_engagement_executions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      auto_engagement_rules: {
        Row: {
          account_age_days: number | null
          account_selection_mode: string | null
          action_type: string | null
          action_types: string[] | null
          actions_today: number | null
          allowed_account_tags: string[] | null
          auto_unfollow_enabled: boolean | null
          created_at: string | null
          daily_limit: number | null
          description: string | null
          detection_delay_minutes: number | null
          error_count: number | null
          exclude_keywords: string[] | null
          exclude_verified: boolean | null
          execution_frequency_minutes: number | null
          execution_interval_hours: number | null
          executor_account_ids: string[] | null
          failure_count: number | null
          has_engagement: boolean | null
          id: string
          is_active: boolean | null
          last_daily_reset: string | null
          last_executed_at: string | null
          last_execution_at: string | null
          like_strategy: string | null
          likes_per_follower: number | null
          max_accounts_per_run: number | null
          max_actions_per_execution: number | null
          max_executions_per_hour: number | null
          max_faves: number | null
          max_followers: number | null
          max_replies: number | null
          max_retweets: number | null
          min_account_age_days: number | null
          min_faves: number | null
          min_followers: number | null
          min_replies: number | null
          min_retweets: number | null
          name: string | null
          next_execution_at: string | null
          reply_template_id: string | null
          require_verified: boolean | null
          rule_name: string | null
          rule_type: string | null
          schedule_days_of_week: number[] | null
          schedule_enabled: boolean | null
          schedule_hours: number[] | null
          search_keywords: string[] | null
          search_query: string | null
          search_since: string | null
          search_type: string | null
          search_until: string | null
          success_count: number | null
          target_urls: string[] | null
          target_user_ids: string[] | null
          total_actions: number | null
          total_actions_count: number | null
          total_executions: number | null
          total_failures: number | null
          total_successes: number | null
          unfollow_after_days: number | null
          unfollow_delay_weeks: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_age_days?: number | null
          account_selection_mode?: string | null
          action_type?: string | null
          action_types?: string[] | null
          actions_today?: number | null
          allowed_account_tags?: string[] | null
          auto_unfollow_enabled?: boolean | null
          created_at?: string | null
          daily_limit?: number | null
          description?: string | null
          detection_delay_minutes?: number | null
          error_count?: number | null
          exclude_keywords?: string[] | null
          exclude_verified?: boolean | null
          execution_frequency_minutes?: number | null
          execution_interval_hours?: number | null
          executor_account_ids?: string[] | null
          failure_count?: number | null
          has_engagement?: boolean | null
          id?: string
          is_active?: boolean | null
          last_daily_reset?: string | null
          last_executed_at?: string | null
          last_execution_at?: string | null
          like_strategy?: string | null
          likes_per_follower?: number | null
          max_accounts_per_run?: number | null
          max_actions_per_execution?: number | null
          max_executions_per_hour?: number | null
          max_faves?: number | null
          max_followers?: number | null
          max_replies?: number | null
          max_retweets?: number | null
          min_account_age_days?: number | null
          min_faves?: number | null
          min_followers?: number | null
          min_replies?: number | null
          min_retweets?: number | null
          name?: string | null
          next_execution_at?: string | null
          reply_template_id?: string | null
          require_verified?: boolean | null
          rule_name?: string | null
          rule_type?: string | null
          schedule_days_of_week?: number[] | null
          schedule_enabled?: boolean | null
          schedule_hours?: number[] | null
          search_keywords?: string[] | null
          search_query?: string | null
          search_since?: string | null
          search_type?: string | null
          search_until?: string | null
          success_count?: number | null
          target_urls?: string[] | null
          target_user_ids?: string[] | null
          total_actions?: number | null
          total_actions_count?: number | null
          total_executions?: number | null
          total_failures?: number | null
          total_successes?: number | null
          unfollow_after_days?: number | null
          unfollow_delay_weeks?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_age_days?: number | null
          account_selection_mode?: string | null
          action_type?: string | null
          action_types?: string[] | null
          actions_today?: number | null
          allowed_account_tags?: string[] | null
          auto_unfollow_enabled?: boolean | null
          created_at?: string | null
          daily_limit?: number | null
          description?: string | null
          detection_delay_minutes?: number | null
          error_count?: number | null
          exclude_keywords?: string[] | null
          exclude_verified?: boolean | null
          execution_frequency_minutes?: number | null
          execution_interval_hours?: number | null
          executor_account_ids?: string[] | null
          failure_count?: number | null
          has_engagement?: boolean | null
          id?: string
          is_active?: boolean | null
          last_daily_reset?: string | null
          last_executed_at?: string | null
          last_execution_at?: string | null
          like_strategy?: string | null
          likes_per_follower?: number | null
          max_accounts_per_run?: number | null
          max_actions_per_execution?: number | null
          max_executions_per_hour?: number | null
          max_faves?: number | null
          max_followers?: number | null
          max_replies?: number | null
          max_retweets?: number | null
          min_account_age_days?: number | null
          min_faves?: number | null
          min_followers?: number | null
          min_replies?: number | null
          min_retweets?: number | null
          name?: string | null
          next_execution_at?: string | null
          reply_template_id?: string | null
          require_verified?: boolean | null
          rule_name?: string | null
          rule_type?: string | null
          schedule_days_of_week?: number[] | null
          schedule_enabled?: boolean | null
          schedule_hours?: number[] | null
          search_keywords?: string[] | null
          search_query?: string | null
          search_since?: string | null
          search_type?: string | null
          search_until?: string | null
          success_count?: number | null
          target_urls?: string[] | null
          target_user_ids?: string[] | null
          total_actions?: number | null
          total_actions_count?: number | null
          total_executions?: number | null
          total_failures?: number | null
          total_successes?: number | null
          unfollow_after_days?: number | null
          unfollow_delay_weeks?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_engagement_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_name: string
          job_type: string
          result: Json | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_name: string
          job_type: string
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_name?: string
          job_type?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      blacklist: {
        Row: {
          created_at: string | null
          entry_type: string
          entry_value: string
          id: string
          is_active: boolean | null
          reason: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry_type: string
          entry_value: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entry_type?: string
          entry_value?: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bulk_post_queue: {
        Row: {
          account_id: string
          content: string
          created_at: string | null
          cta_template_id: string | null
          error_json: Json | null
          error_message: string | null
          executed_at: string | null
          generated_content: string | null
          id: string
          max_retries: number | null
          media_urls: string[] | null
          next_retry_at: string | null
          post_id: string | null
          posted_at: string | null
          priority: number | null
          retry_count: number | null
          scheduled_at: string
          setting_id: string | null
          status: string
          tags: string[] | null
          target_account_id: string | null
          target_x_user_id: string | null
          template_id: string | null
          tweet_id: string | null
          updated_at: string | null
          use_cta: boolean | null
          use_template_items: boolean | null
          user_id: string
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string | null
          cta_template_id?: string | null
          error_json?: Json | null
          error_message?: string | null
          executed_at?: string | null
          generated_content?: string | null
          id?: string
          max_retries?: number | null
          media_urls?: string[] | null
          next_retry_at?: string | null
          post_id?: string | null
          posted_at?: string | null
          priority?: number | null
          retry_count?: number | null
          scheduled_at: string
          setting_id?: string | null
          status?: string
          tags?: string[] | null
          target_account_id?: string | null
          target_x_user_id?: string | null
          template_id?: string | null
          tweet_id?: string | null
          updated_at?: string | null
          use_cta?: boolean | null
          use_template_items?: boolean | null
          user_id: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string | null
          cta_template_id?: string | null
          error_json?: Json | null
          error_message?: string | null
          executed_at?: string | null
          generated_content?: string | null
          id?: string
          max_retries?: number | null
          media_urls?: string[] | null
          next_retry_at?: string | null
          post_id?: string | null
          posted_at?: string | null
          priority?: number | null
          retry_count?: number | null
          scheduled_at?: string
          setting_id?: string | null
          status?: string
          tags?: string[] | null
          target_account_id?: string | null
          target_x_user_id?: string | null
          template_id?: string | null
          tweet_id?: string | null
          updated_at?: string | null
          use_cta?: boolean | null
          use_template_items?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_post_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bulk_post_settings: {
        Row: {
          account_selection_mode: string | null
          active_days: number[] | null
          created_at: string | null
          description: string | null
          end_time: string | null
          id: string
          is_active: boolean | null
          max_interval_minutes: number | null
          min_interval_minutes: number | null
          setting_name: string
          start_time: string | null
          target_account_ids: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_selection_mode?: string | null
          active_days?: number[] | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          max_interval_minutes?: number | null
          min_interval_minutes?: number | null
          setting_name: string
          start_time?: string | null
          target_account_ids?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_selection_mode?: string | null
          active_days?: number[] | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          max_interval_minutes?: number | null
          min_interval_minutes?: number | null
          setting_name?: string
          start_time?: string | null
          target_account_ids?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_post_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      competitors: {
        Row: {
          competitor_handle: string
          competitor_name: string
          created_at: string | null
          followers_count: number | null
          following_count: number | null
          id: string
          industry: string | null
          is_active: boolean | null
          last_analyzed_at: string | null
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          competitor_handle: string
          competitor_name: string
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          last_analyzed_at?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          competitor_handle?: string
          competitor_name?: string
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          last_analyzed_at?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cta_executions: {
        Row: {
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          reply_tweet_id: string | null
          scheduled_at: string
          status: string
          target_tweet_id: string
          trigger_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          reply_tweet_id?: string | null
          scheduled_at: string
          status?: string
          target_tweet_id: string
          trigger_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          reply_tweet_id?: string | null
          scheduled_at?: string
          status?: string
          target_tweet_id?: string
          trigger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cta_executions_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "cta_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      cta_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          cta_url: string | null
          id: string
          is_active: boolean | null
          name: string
          tags: string[] | null
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          cta_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          cta_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cta_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cta_triggers: {
        Row: {
          created_at: string
          cta_template_id: string
          id: string
          is_active: boolean | null
          last_checked_post_id: string | null
          max_delay_minutes: number | null
          min_delay_minutes: number | null
          name: string
          responder_account_id: string
          target_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cta_template_id: string
          id?: string
          is_active?: boolean | null
          last_checked_post_id?: string | null
          max_delay_minutes?: number | null
          min_delay_minutes?: number | null
          name: string
          responder_account_id: string
          target_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cta_template_id?: string
          id?: string
          is_active?: boolean | null
          last_checked_post_id?: string | null
          max_delay_minutes?: number | null
          min_delay_minutes?: number | null
          name?: string
          responder_account_id?: string
          target_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cta_triggers_cta_template_id_fkey"
            columns: ["cta_template_id"]
            isOneToOne: false
            referencedRelation: "post_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_triggers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      daily_stats: {
        Row: {
          api_errors: number | null
          created_at: string | null
          follows_made: number | null
          follows_received: number | null
          id: string
          impressions: number | null
          likes_given: number | null
          likes_received: number | null
          posts_failed: number | null
          posts_scheduled: number | null
          posts_sent: number | null
          rate_limit_hits: number | null
          replies_received: number | null
          replies_sent: number | null
          retweets_made: number | null
          stat_date: string
          unfollows_made: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_errors?: number | null
          created_at?: string | null
          follows_made?: number | null
          follows_received?: number | null
          id?: string
          impressions?: number | null
          likes_given?: number | null
          likes_received?: number | null
          posts_failed?: number | null
          posts_scheduled?: number | null
          posts_sent?: number | null
          rate_limit_hits?: number | null
          replies_received?: number | null
          replies_sent?: number | null
          retweets_made?: number | null
          stat_date?: string
          unfollows_made?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_errors?: number | null
          created_at?: string | null
          follows_made?: number | null
          follows_received?: number | null
          id?: string
          impressions?: number | null
          likes_given?: number | null
          likes_received?: number | null
          posts_failed?: number | null
          posts_scheduled?: number | null
          posts_sent?: number | null
          rate_limit_hits?: number | null
          replies_received?: number | null
          replies_sent?: number | null
          retweets_made?: number | null
          stat_date?: string
          unfollows_made?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dm_send_logs: {
        Row: {
          account_token_id: string
          account_type: string
          created_at: string | null
          error_message: string | null
          id: string
          response_data: Json | null
          rule_id: string | null
          sent_at: string | null
          status: string
          target_user_id: string
          target_username: string | null
          template_id: string | null
          user_id: string
        }
        Insert: {
          account_token_id: string
          account_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          response_data?: Json | null
          rule_id?: string | null
          sent_at?: string | null
          status: string
          target_user_id: string
          target_username?: string | null
          template_id?: string | null
          user_id: string
        }
        Update: {
          account_token_id?: string
          account_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          response_data?: Json | null
          rule_id?: string | null
          sent_at?: string | null
          status?: string
          target_user_id?: string
          target_username?: string | null
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_send_logs_account_token_id_fkey"
            columns: ["account_token_id"]
            isOneToOne: false
            referencedRelation: "account_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_send_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "dm_send_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_send_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_send_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dm_send_queue: {
        Row: {
          account_token_id: string
          account_type: string
          created_at: string | null
          error_message: string | null
          id: string
          retry_count: number | null
          rule_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          target_user_id: string
          target_username: string | null
          template_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_token_id: string
          account_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          retry_count?: number | null
          rule_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          target_user_id: string
          target_username?: string | null
          template_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_token_id?: string
          account_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          retry_count?: number | null
          rule_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          target_user_id?: string
          target_username?: string | null
          template_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_send_queue_account_token_id_fkey"
            columns: ["account_token_id"]
            isOneToOne: false
            referencedRelation: "account_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_send_queue_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "dm_send_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_send_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_send_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dm_send_rules: {
        Row: {
          account_token_id: string
          account_type: string
          created_at: string | null
          daily_limit: number | null
          delay_slot_hours: number
          id: string
          last_enqueued_at: string | null
          status: string
          template_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_token_id: string
          account_type: string
          created_at?: string | null
          daily_limit?: number | null
          delay_slot_hours?: number
          id?: string
          last_enqueued_at?: string | null
          status?: string
          template_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_token_id?: string
          account_type?: string
          created_at?: string | null
          daily_limit?: number | null
          delay_slot_hours?: number
          id?: string
          last_enqueued_at?: string | null
          status?: string
          template_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_send_rules_account_token_id_fkey"
            columns: ["account_token_id"]
            isOneToOne: false
            referencedRelation: "account_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_send_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_send_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      engagement_settings: {
        Row: {
          created_at: string | null
          enable_follower_filters: boolean | null
          enable_rate_limiting: boolean | null
          id: string
          max_daily_engagements: number | null
          max_engagement_interval_seconds: number | null
          max_hourly_engagements: number | null
          max_target_follower_count: number | null
          min_engagement_interval_seconds: number | null
          min_target_follower_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enable_follower_filters?: boolean | null
          enable_rate_limiting?: boolean | null
          id?: string
          max_daily_engagements?: number | null
          max_engagement_interval_seconds?: number | null
          max_hourly_engagements?: number | null
          max_target_follower_count?: number | null
          min_engagement_interval_seconds?: number | null
          min_target_follower_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enable_follower_filters?: boolean | null
          enable_rate_limiting?: boolean | null
          id?: string
          max_daily_engagements?: number | null
          max_engagement_interval_seconds?: number | null
          max_hourly_engagements?: number | null
          max_target_follower_count?: number | null
          min_engagement_interval_seconds?: number | null
          min_target_follower_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      execution_logs: {
        Row: {
          account_ids: string[] | null
          account_type: string | null
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          execution_type: string
          id: string
          ip_address: string | null
          items_failed: number | null
          items_processed: number | null
          items_succeeded: number | null
          proxy_id: string | null
          result_data: Json | null
          rule_id: string | null
          started_at: string | null
          status: string
          target_data: Json | null
          user_id: string
        }
        Insert: {
          account_ids?: string[] | null
          account_type?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_type: string
          id?: string
          ip_address?: string | null
          items_failed?: number | null
          items_processed?: number | null
          items_succeeded?: number | null
          proxy_id?: string | null
          result_data?: Json | null
          rule_id?: string | null
          started_at?: string | null
          status: string
          target_data?: Json | null
          user_id: string
        }
        Update: {
          account_ids?: string[] | null
          account_type?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_type?: string
          id?: string
          ip_address?: string | null
          items_failed?: number | null
          items_processed?: number | null
          items_succeeded?: number | null
          proxy_id?: string | null
          result_data?: Json | null
          rule_id?: string | null
          started_at?: string | null
          status?: string
          target_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_logs_proxy_id_fkey"
            columns: ["proxy_id"]
            isOneToOne: false
            referencedRelation: "proxies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      follow_accounts: {
        Row: {
          auth_token: string | null
          backup_codes: string | null
          category: string | null
          created_at: string | null
          email: string | null
          followers_count: number | null
          id: string
          is_active: boolean | null
          mail_password: string | null
          management_label_id: string | null
          notes: string | null
          password: string | null
          priority: number | null
          proxy_id: string | null
          reg_number: string | null
          tags: string[] | null
          target_handle: string
          target_name: string
          two_factor_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_token?: string | null
          backup_codes?: string | null
          category?: string | null
          created_at?: string | null
          email?: string | null
          followers_count?: number | null
          id?: string
          is_active?: boolean | null
          mail_password?: string | null
          management_label_id?: string | null
          notes?: string | null
          password?: string | null
          priority?: number | null
          proxy_id?: string | null
          reg_number?: string | null
          tags?: string[] | null
          target_handle: string
          target_name: string
          two_factor_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_token?: string | null
          backup_codes?: string | null
          category?: string | null
          created_at?: string | null
          email?: string | null
          followers_count?: number | null
          id?: string
          is_active?: boolean | null
          mail_password?: string | null
          management_label_id?: string | null
          notes?: string | null
          password?: string | null
          priority?: number | null
          proxy_id?: string | null
          reg_number?: string | null
          tags?: string[] | null
          target_handle?: string
          target_name?: string
          two_factor_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_accounts_management_label_id_fkey"
            columns: ["management_label_id"]
            isOneToOne: false
            referencedRelation: "management_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_accounts_proxy_id_fkey"
            columns: ["proxy_id"]
            isOneToOne: false
            referencedRelation: "proxies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      follow_history: {
        Row: {
          account_id: string
          auto_unfollow_enabled: boolean | null
          engagement_rule_id: string | null
          followed_at: string | null
          id: string
          metadata: Json | null
          scheduled_unfollow_at: string | null
          status: string
          target_user_id: string
          target_username: string
          unfollow_after_days: number | null
          unfollowed_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          auto_unfollow_enabled?: boolean | null
          engagement_rule_id?: string | null
          followed_at?: string | null
          id?: string
          metadata?: Json | null
          scheduled_unfollow_at?: string | null
          status?: string
          target_user_id: string
          target_username: string
          unfollow_after_days?: number | null
          unfollowed_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          auto_unfollow_enabled?: boolean | null
          engagement_rule_id?: string | null
          followed_at?: string | null
          id?: string
          metadata?: Json | null
          scheduled_unfollow_at?: string | null
          status?: string
          target_user_id?: string
          target_username?: string
          unfollow_after_days?: number | null
          unfollowed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      follow_relationships: {
        Row: {
          created_at: string
          error_message: string | null
          followed_at: string
          follower_account_id: string
          id: string
          status: string
          target_handle: string | null
          target_twitter_id: string
          unfollow_at: string
          unfollowed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          followed_at?: string
          follower_account_id: string
          id?: string
          status?: string
          target_handle?: string | null
          target_twitter_id: string
          unfollow_at: string
          unfollowed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          followed_at?: string
          follower_account_id?: string
          id?: string
          status?: string
          target_handle?: string | null
          target_twitter_id?: string
          unfollow_at?: string
          unfollowed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_relationships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      follower_snapshots: {
        Row: {
          account_token_id: string
          created_at: string | null
          id: string
          last_cursor: string | null
          last_follower_count: number | null
          last_sync_at: string | null
          recent_follower_ids: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_token_id: string
          created_at?: string | null
          id?: string
          last_cursor?: string | null
          last_follower_count?: number | null
          last_sync_at?: string | null
          recent_follower_ids?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_token_id?: string
          created_at?: string | null
          id?: string
          last_cursor?: string | null
          last_follower_count?: number | null
          last_sync_at?: string | null
          recent_follower_ids?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follower_snapshots_account_token_id_fkey"
            columns: ["account_token_id"]
            isOneToOne: false
            referencedRelation: "account_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follower_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      loop_executions: {
        Row: {
          created_posts_count: number | null
          error_message: string | null
          exec_data: Json | null
          executed_at: string | null
          executor_account_id: string | null
          id: string
          loop_id: string
          sent_replies_count: number | null
          status: string
          trace_id: string | null
          used_account_ids: string[] | null
          user_id: string
        }
        Insert: {
          created_posts_count?: number | null
          error_message?: string | null
          exec_data?: Json | null
          executed_at?: string | null
          executor_account_id?: string | null
          id?: string
          loop_id: string
          sent_replies_count?: number | null
          status?: string
          trace_id?: string | null
          used_account_ids?: string[] | null
          user_id: string
        }
        Update: {
          created_posts_count?: number | null
          error_message?: string | null
          exec_data?: Json | null
          executed_at?: string | null
          executor_account_id?: string | null
          id?: string
          loop_id?: string
          sent_replies_count?: number | null
          status?: string
          trace_id?: string | null
          used_account_ids?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loop_executions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      loops: {
        Row: {
          allowed_account_tags: string[] | null
          created_at: string | null
          description: string | null
          execution_count: number | null
          execution_interval_hours: number
          execution_interval_minutes: number | null
          executor_account_ids: string[] | null
          id: string
          is_active: boolean | null
          jitter_max_minutes: number | null
          jitter_min_minutes: number | null
          last_execution_at: string | null
          last_processed_tweet_id: string | null
          last_used_template_index: number | null
          locked_until: string | null
          loop_name: string
          loop_type: string
          max_accounts: number | null
          min_accounts: number | null
          monitor_account_handle: string | null
          next_execution_at: string | null
          post_count: number | null
          reply_delay_max_minutes: number | null
          reply_delay_min_minutes: number | null
          reply_template_id: string | null
          selection_mode: string | null
          tags: string[] | null
          target_type: string | null
          target_value: string | null
          template_ids: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allowed_account_tags?: string[] | null
          created_at?: string | null
          description?: string | null
          execution_count?: number | null
          execution_interval_hours?: number
          execution_interval_minutes?: number | null
          executor_account_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          jitter_max_minutes?: number | null
          jitter_min_minutes?: number | null
          last_execution_at?: string | null
          last_processed_tweet_id?: string | null
          last_used_template_index?: number | null
          locked_until?: string | null
          loop_name: string
          loop_type?: string
          max_accounts?: number | null
          min_accounts?: number | null
          monitor_account_handle?: string | null
          next_execution_at?: string | null
          post_count?: number | null
          reply_delay_max_minutes?: number | null
          reply_delay_min_minutes?: number | null
          reply_template_id?: string | null
          selection_mode?: string | null
          tags?: string[] | null
          target_type?: string | null
          target_value?: string | null
          template_ids?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allowed_account_tags?: string[] | null
          created_at?: string | null
          description?: string | null
          execution_count?: number | null
          execution_interval_hours?: number
          execution_interval_minutes?: number | null
          executor_account_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          jitter_max_minutes?: number | null
          jitter_min_minutes?: number | null
          last_execution_at?: string | null
          last_processed_tweet_id?: string | null
          last_used_template_index?: number | null
          locked_until?: string | null
          loop_name?: string
          loop_type?: string
          max_accounts?: number | null
          min_accounts?: number | null
          monitor_account_handle?: string | null
          next_execution_at?: string | null
          post_count?: number | null
          reply_delay_max_minutes?: number | null
          reply_delay_min_minutes?: number | null
          reply_template_id?: string | null
          selection_mode?: string | null
          tags?: string[] | null
          target_type?: string | null
          target_value?: string | null
          template_ids?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loops_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      main_accounts: {
        Row: {
          auth_token: string | null
          backup_codes: string | null
          created_at: string | null
          email: string | null
          follower_count: number | null
          following_count: number | null
          handle: string
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          last_activity_at: string | null
          mail_password: string | null
          management_label_id: string | null
          name: string
          password: string | null
          reg_number: string | null
          tags: string[] | null
          two_factor_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_token?: string | null
          backup_codes?: string | null
          created_at?: string | null
          email?: string | null
          follower_count?: number | null
          following_count?: number | null
          handle: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_activity_at?: string | null
          mail_password?: string | null
          management_label_id?: string | null
          name: string
          password?: string | null
          reg_number?: string | null
          tags?: string[] | null
          two_factor_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_token?: string | null
          backup_codes?: string | null
          created_at?: string | null
          email?: string | null
          follower_count?: number | null
          following_count?: number | null
          handle?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_activity_at?: string | null
          mail_password?: string | null
          management_label_id?: string | null
          name?: string
          password?: string | null
          reg_number?: string | null
          tags?: string[] | null
          two_factor_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "main_accounts_management_label_id_fkey"
            columns: ["management_label_id"]
            isOneToOne: false
            referencedRelation: "management_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "main_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      management_labels: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_labels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      nordvpn_accounts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_validated_at: string | null
          password: string
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_validated_at?: string | null
          password: string
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_validated_at?: string | null
          password?: string
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "nordvpn_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      nordvpn_servers: {
        Row: {
          city: string | null
          country: string
          created_at: string | null
          hostname: string
          id: string
          is_active: boolean | null
          last_updated_at: string | null
          load_percentage: number | null
          proxy_url: string | null
          server_id: string
        }
        Insert: {
          city?: string | null
          country: string
          created_at?: string | null
          hostname: string
          id?: string
          is_active?: boolean | null
          last_updated_at?: string | null
          load_percentage?: number | null
          proxy_url?: string | null
          server_id: string
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string | null
          hostname?: string
          id?: string
          is_active?: boolean | null
          last_updated_at?: string | null
          load_percentage?: number | null
          proxy_url?: string | null
          server_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          notification_type: string
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          notification_type: string
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      oauth_sessions: {
        Row: {
          account_id: string | null
          account_type: string
          code_challenge: string | null
          code_verifier: string | null
          created_at: string | null
          expires_at: string
          id: string
          oauth_version: string
          state: string
          twitter_app_id: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          account_type: string
          code_challenge?: string | null
          code_verifier?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          oauth_version: string
          state: string
          twitter_app_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          account_type?: string
          code_challenge?: string | null
          code_verifier?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          oauth_version?: string
          state?: string
          twitter_app_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      post_engagement_history: {
        Row: {
          id: string
          impression_count: number | null
          like_count: number | null
          post_id: string
          quote_count: number | null
          recorded_at: string
          reply_count: number | null
          retweet_count: number | null
        }
        Insert: {
          id?: string
          impression_count?: number | null
          like_count?: number | null
          post_id: string
          quote_count?: number | null
          recorded_at?: string
          reply_count?: number | null
          retweet_count?: number | null
        }
        Update: {
          id?: string
          impression_count?: number | null
          like_count?: number | null
          post_id?: string
          quote_count?: number | null
          recorded_at?: string
          reply_count?: number | null
          retweet_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_engagement_history_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_engagement_history_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "v_post_performance"
            referencedColumns: ["id"]
          },
        ]
      }
      post_template_items: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          order_index: number
          template_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_index: number
          template_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number
          template_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "post_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_template_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      post_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          tags: string[] | null
          template_name: string
          template_type: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
          variables: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          template_name: string
          template_type: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
          variables?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          template_name?: string
          template_type?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "post_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      posts: {
        Row: {
          account_id: string
          content: string
          created_at: string | null
          engagement_count: number | null
          engagement_updated_at: string | null
          error_json: Json | null
          error_message: string | null
          id: string
          impression_count: number | null
          in_reply_to_tweet_id: string | null
          like_count: number | null
          media_urls: string[] | null
          posted_at: string | null
          quote_count: number | null
          reply_count: number | null
          retweet_count: number | null
          scheduled_at: string | null
          status: string
          tags: string[] | null
          text_hash: string | null
          tweet_id: string | null
          twitter_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string | null
          engagement_count?: number | null
          engagement_updated_at?: string | null
          error_json?: Json | null
          error_message?: string | null
          id?: string
          impression_count?: number | null
          in_reply_to_tweet_id?: string | null
          like_count?: number | null
          media_urls?: string[] | null
          posted_at?: string | null
          quote_count?: number | null
          reply_count?: number | null
          retweet_count?: number | null
          scheduled_at?: string | null
          status?: string
          tags?: string[] | null
          text_hash?: string | null
          tweet_id?: string | null
          twitter_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string | null
          engagement_count?: number | null
          engagement_updated_at?: string | null
          error_json?: Json | null
          error_message?: string | null
          id?: string
          impression_count?: number | null
          in_reply_to_tweet_id?: string | null
          like_count?: number | null
          media_urls?: string[] | null
          posted_at?: string | null
          quote_count?: number | null
          reply_count?: number | null
          retweet_count?: number | null
          scheduled_at?: string | null
          status?: string
          tags?: string[] | null
          text_hash?: string | null
          tweet_id?: string | null
          twitter_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      proxies: {
        Row: {
          assigned_accounts_count: number | null
          city: string | null
          country: string | null
          created_at: string | null
          error_message: string | null
          failure_count: number | null
          host: string | null
          id: string
          is_active: boolean | null
          last_checked_at: string | null
          last_tested_at: string | null
          last_used_at: string | null
          notes: string | null
          password: string | null
          port: number | null
          proxy_name: string | null
          proxy_type: string
          proxy_url: string
          response_time_ms: number | null
          tags: string[] | null
          test_status: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          assigned_accounts_count?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          error_message?: string | null
          failure_count?: number | null
          host?: string | null
          id?: string
          is_active?: boolean | null
          last_checked_at?: string | null
          last_tested_at?: string | null
          last_used_at?: string | null
          notes?: string | null
          password?: string | null
          port?: number | null
          proxy_name?: string | null
          proxy_type: string
          proxy_url: string
          response_time_ms?: number | null
          tags?: string[] | null
          test_status?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          assigned_accounts_count?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          error_message?: string | null
          failure_count?: number | null
          host?: string | null
          id?: string
          is_active?: boolean | null
          last_checked_at?: string | null
          last_tested_at?: string | null
          last_used_at?: string | null
          notes?: string | null
          password?: string | null
          port?: number | null
          proxy_name?: string | null
          proxy_type?: string
          proxy_url?: string
          response_time_ms?: number | null
          tags?: string[] | null
          test_status?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proxies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      proxy_assignments: {
        Row: {
          account_id: string
          assigned_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          proxy_id: string
          user_id: string
        }
        Insert: {
          account_id: string
          assigned_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          proxy_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          assigned_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          proxy_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proxy_assignments_proxy_id_fkey"
            columns: ["proxy_id"]
            isOneToOne: false
            referencedRelation: "proxies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      proxy_settings: {
        Row: {
          assignment_strategy: string | null
          auto_assign_enabled: boolean | null
          created_at: string
          exclude_main_accounts: boolean | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_strategy?: string | null
          auto_assign_enabled?: boolean | null
          created_at?: string
          exclude_main_accounts?: boolean | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_strategy?: string | null
          auto_assign_enabled?: boolean | null
          created_at?: string
          exclude_main_accounts?: boolean | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proxy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      proxy_usage_stats: {
        Row: {
          avg_response_time_ms: number | null
          date: string
          error_count: number | null
          id: string
          proxy_id: string
          request_count: number | null
          success_count: number | null
          user_id: string
        }
        Insert: {
          avg_response_time_ms?: number | null
          date?: string
          error_count?: number | null
          id?: string
          proxy_id: string
          request_count?: number | null
          success_count?: number | null
          user_id: string
        }
        Update: {
          avg_response_time_ms?: number | null
          date?: string
          error_count?: number | null
          id?: string
          proxy_id?: string
          request_count?: number | null
          success_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proxy_usage_stats_proxy_id_fkey"
            columns: ["proxy_id"]
            isOneToOne: false
            referencedRelation: "proxies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_usage_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          account_token_id: string | null
          app_id: string | null
          created_at: string | null
          endpoint: string | null
          id: string
          is_warning: boolean | null
          limit_total: number | null
          limit_type: string
          remaining: number
          reset_at: string
          resource_id: string
          resource_type: string
          token_type: string | null
          total_limit: number
          updated_at: string | null
          used_requests: number | null
          user_id: string
          warning_threshold: number | null
          window_started_at: string | null
        }
        Insert: {
          account_token_id?: string | null
          app_id?: string | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          is_warning?: boolean | null
          limit_total?: number | null
          limit_type: string
          remaining: number
          reset_at: string
          resource_id: string
          resource_type: string
          token_type?: string | null
          total_limit: number
          updated_at?: string | null
          used_requests?: number | null
          user_id: string
          warning_threshold?: number | null
          window_started_at?: string | null
        }
        Update: {
          account_token_id?: string | null
          app_id?: string | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          is_warning?: boolean | null
          limit_total?: number | null
          limit_type?: string
          remaining?: number
          reset_at?: string
          resource_id?: string
          resource_type?: string
          token_type?: string | null
          total_limit?: number
          updated_at?: string | null
          used_requests?: number | null
          user_id?: string
          warning_threshold?: number | null
          window_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reports: {
        Row: {
          configuration: Json
          created_at: string | null
          id: string
          last_generated_at: string | null
          report_name: string
          report_type: string
          schedule_enabled: boolean | null
          schedule_frequency: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          configuration?: Json
          created_at?: string | null
          id?: string
          last_generated_at?: string | null
          report_name: string
          report_type: string
          schedule_enabled?: boolean | null
          schedule_frequency?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          configuration?: Json
          created_at?: string | null
          id?: string
          last_generated_at?: string | null
          report_name?: string
          report_type?: string
          schedule_enabled?: boolean | null
          schedule_frequency?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      scheduler_settings: {
        Row: {
          configuration: Json | null
          created_at: string | null
          cron_expression: string | null
          id: string
          interval_minutes: number | null
          is_enabled: boolean | null
          job_name: string
          job_type: string
          last_run_at: string | null
          next_run_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          cron_expression?: string | null
          id?: string
          interval_minutes?: number | null
          is_enabled?: boolean | null
          job_name: string
          job_type: string
          last_run_at?: string | null
          next_run_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          cron_expression?: string | null
          id?: string
          interval_minutes?: number | null
          is_enabled?: boolean | null
          job_name?: string
          job_type?: string
          last_run_at?: string | null
          next_run_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduler_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      spam_accounts: {
        Row: {
          auth_token: string | null
          backup_codes: string | null
          ban_status: string | null
          created_at: string | null
          email: string | null
          handle: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          mail_password: string | null
          management_label_id: string | null
          name: string
          notes: string | null
          password: string | null
          proxy_id: string | null
          reg_number: string | null
          success_rate: number | null
          tags: string[] | null
          two_factor_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_token?: string | null
          backup_codes?: string | null
          ban_status?: string | null
          created_at?: string | null
          email?: string | null
          handle: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          mail_password?: string | null
          management_label_id?: string | null
          name: string
          notes?: string | null
          password?: string | null
          proxy_id?: string | null
          reg_number?: string | null
          success_rate?: number | null
          tags?: string[] | null
          two_factor_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_token?: string | null
          backup_codes?: string | null
          ban_status?: string | null
          created_at?: string | null
          email?: string | null
          handle?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          mail_password?: string | null
          management_label_id?: string | null
          name?: string
          notes?: string | null
          password?: string | null
          proxy_id?: string | null
          reg_number?: string | null
          success_rate?: number | null
          tags?: string[] | null
          two_factor_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spam_accounts_management_label_id_fkey"
            columns: ["management_label_id"]
            isOneToOne: false
            referencedRelation: "management_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spam_accounts_proxy_id_fkey"
            columns: ["proxy_id"]
            isOneToOne: false
            referencedRelation: "proxies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spam_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tag_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          tag_color: string | null
          tag_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          tag_color?: string | null
          tag_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          tag_color?: string | null
          tag_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      targeted_engagement_actions: {
        Row: {
          account_id: string
          account_type: string
          action_type: string
          created_at: string | null
          error_message: string | null
          id: string
          success: boolean
          targeted_engagement_id: string
          twitter_response: Json | null
        }
        Insert: {
          account_id: string
          account_type: string
          action_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          success: boolean
          targeted_engagement_id: string
          twitter_response?: Json | null
        }
        Update: {
          account_id?: string
          account_type?: string
          action_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          success?: boolean
          targeted_engagement_id?: string
          twitter_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "targeted_engagement_actions_targeted_engagement_id_fkey"
            columns: ["targeted_engagement_id"]
            isOneToOne: false
            referencedRelation: "targeted_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      targeted_engagements: {
        Row: {
          account_type: string
          actions_completed: number | null
          completed_at: string | null
          created_at: string | null
          delay_between_actions_ms: number | null
          enable_follow: boolean | null
          enable_like: boolean | null
          enable_quote: boolean | null
          enable_reply: boolean | null
          enable_retweet: boolean | null
          error_message: string | null
          id: string
          last_action_at: string | null
          max_actions_per_hour: number | null
          max_total_actions: number | null
          quote_template: string | null
          reply_template: string | null
          selected_account_ids: string[] | null
          started_at: string | null
          status: string | null
          target_tweet_id: string | null
          target_url: string
          updated_at: string | null
          use_all_accounts: boolean | null
          user_id: string
        }
        Insert: {
          account_type: string
          actions_completed?: number | null
          completed_at?: string | null
          created_at?: string | null
          delay_between_actions_ms?: number | null
          enable_follow?: boolean | null
          enable_like?: boolean | null
          enable_quote?: boolean | null
          enable_reply?: boolean | null
          enable_retweet?: boolean | null
          error_message?: string | null
          id?: string
          last_action_at?: string | null
          max_actions_per_hour?: number | null
          max_total_actions?: number | null
          quote_template?: string | null
          reply_template?: string | null
          selected_account_ids?: string[] | null
          started_at?: string | null
          status?: string | null
          target_tweet_id?: string | null
          target_url: string
          updated_at?: string | null
          use_all_accounts?: boolean | null
          user_id: string
        }
        Update: {
          account_type?: string
          actions_completed?: number | null
          completed_at?: string | null
          created_at?: string | null
          delay_between_actions_ms?: number | null
          enable_follow?: boolean | null
          enable_like?: boolean | null
          enable_quote?: boolean | null
          enable_reply?: boolean | null
          enable_retweet?: boolean | null
          error_message?: string | null
          id?: string
          last_action_at?: string | null
          max_actions_per_hour?: number | null
          max_total_actions?: number | null
          quote_template?: string | null
          reply_template?: string | null
          selected_account_ids?: string[] | null
          started_at?: string | null
          status?: string | null
          target_tweet_id?: string | null
          target_url?: string
          updated_at?: string | null
          use_all_accounts?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "targeted_engagements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          tags: string[] | null
          template_name: string
          template_type: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
          variables: string[] | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          template_name: string
          template_type: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
          variables?: string[] | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          template_name?: string
          template_type?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tweet_engagements: {
        Row: {
          account_filter_tags: string[] | null
          completed_likes: number | null
          completed_replies: number | null
          created_at: string | null
          error_message: string | null
          executor_account_ids: string[] | null
          id: string
          like_enabled: boolean | null
          progress_percentage: number | null
          reply_template_id: string | null
          status: string
          tweet_id: string
          tweet_preview: Json | null
          tweet_url: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_filter_tags?: string[] | null
          completed_likes?: number | null
          completed_replies?: number | null
          created_at?: string | null
          error_message?: string | null
          executor_account_ids?: string[] | null
          id?: string
          like_enabled?: boolean | null
          progress_percentage?: number | null
          reply_template_id?: string | null
          status?: string
          tweet_id: string
          tweet_preview?: Json | null
          tweet_url: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_filter_tags?: string[] | null
          completed_likes?: number | null
          completed_replies?: number | null
          created_at?: string | null
          error_message?: string | null
          executor_account_ids?: string[] | null
          id?: string
          like_enabled?: boolean | null
          progress_percentage?: number | null
          reply_template_id?: string | null
          status?: string
          tweet_id?: string
          tweet_preview?: Json | null
          tweet_url?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tweet_engagements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      twitter_apps: {
        Row: {
          app_name: string
          bearer_token: string | null
          callback_url: string | null
          client_id: string | null
          client_secret: string | null
          consumer_key: string | null
          consumer_secret: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          notes: string | null
          oauth_version: string | null
          permissions: string[] | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_name: string
          bearer_token?: string | null
          callback_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          notes?: string | null
          oauth_version?: string | null
          permissions?: string[] | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_name?: string
          bearer_token?: string | null
          callback_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          notes?: string | null
          oauth_version?: string | null
          permissions?: string[] | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twitter_apps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      url_engagements: {
        Row: {
          account_filter_tags: string[] | null
          completed_likes: number | null
          completed_replies: number | null
          created_at: string | null
          error_message: string | null
          executor_account_ids: string[] | null
          id: string
          like_count: number | null
          progress_percentage: number | null
          reply_template_id: string | null
          status: string
          target_url: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_filter_tags?: string[] | null
          completed_likes?: number | null
          completed_replies?: number | null
          created_at?: string | null
          error_message?: string | null
          executor_account_ids?: string[] | null
          id?: string
          like_count?: number | null
          progress_percentage?: number | null
          reply_template_id?: string | null
          status?: string
          target_url: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_filter_tags?: string[] | null
          completed_likes?: number | null
          completed_replies?: number | null
          created_at?: string | null
          error_message?: string | null
          executor_account_ids?: string[] | null
          id?: string
          like_count?: number | null
          progress_percentage?: number | null
          reply_template_id?: string | null
          status?: string
          target_url?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "url_engagements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_settings: {
        Row: {
          auto_refresh_tokens: boolean | null
          auto_retry_failed: boolean | null
          concurrent_operations: number | null
          created_at: string | null
          default_engagement_delay_minutes: number | null
          default_post_interval_hours: number | null
          default_unfollow_delay_weeks: number | null
          email_notifications: boolean | null
          global_rate_limit_per_hour: number | null
          id: string
          language: string | null
          max_retry_attempts: number | null
          notification_on_completion: boolean | null
          notification_on_error: boolean | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_refresh_tokens?: boolean | null
          auto_retry_failed?: boolean | null
          concurrent_operations?: number | null
          created_at?: string | null
          default_engagement_delay_minutes?: number | null
          default_post_interval_hours?: number | null
          default_unfollow_delay_weeks?: number | null
          email_notifications?: boolean | null
          global_rate_limit_per_hour?: number | null
          id?: string
          language?: string | null
          max_retry_attempts?: number | null
          notification_on_completion?: boolean | null
          notification_on_error?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_refresh_tokens?: boolean | null
          auto_retry_failed?: boolean | null
          concurrent_operations?: number | null
          created_at?: string | null
          default_engagement_delay_minutes?: number | null
          default_post_interval_hours?: number | null
          default_unfollow_delay_weeks?: number | null
          email_notifications?: boolean | null
          global_rate_limit_per_hour?: number | null
          id?: string
          language?: string | null
          max_retry_attempts?: number | null
          notification_on_completion?: boolean | null
          notification_on_error?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      v_account_overview: {
        Row: {
          account_type: string | null
          created_at: string | null
          follower_count: number | null
          following_count: number | null
          handle: string | null
          id: string | null
          is_active: boolean | null
          is_verified: boolean | null
          name: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_active_loop_locks: {
        Row: {
          id: string | null
          locked_until: string | null
          loop_name: string | null
          time_remaining: unknown
        }
        Insert: {
          id?: string | null
          locked_until?: string | null
          loop_name?: string | null
          time_remaining?: never
        }
        Update: {
          id?: string | null
          locked_until?: string | null
          loop_name?: string | null
          time_remaining?: never
        }
        Relationships: []
      }
      v_dashboard_summary: {
        Row: {
          active_follow_accounts: number | null
          active_loops: number | null
          active_main_accounts: number | null
          active_rules: number | null
          active_spam_accounts: number | null
          pending_cta: number | null
          pending_unfollows: number | null
          posts_today: number | null
          scheduled_posts: number | null
          user_id: string | null
        }
        Insert: {
          active_follow_accounts?: never
          active_loops?: never
          active_main_accounts?: never
          active_rules?: never
          active_spam_accounts?: never
          pending_cta?: never
          pending_unfollows?: never
          posts_today?: never
          scheduled_posts?: never
          user_id?: string | null
        }
        Update: {
          active_follow_accounts?: never
          active_loops?: never
          active_main_accounts?: never
          active_rules?: never
          active_spam_accounts?: never
          pending_cta?: never
          pending_unfollows?: never
          posts_today?: never
          scheduled_posts?: never
          user_id?: string | null
        }
        Relationships: []
      }
      v_engagement_daily_stats: {
        Row: {
          execution_date: string | null
          executions_count: number | null
          rule_id: string | null
          rule_name: string | null
          search_type: string | null
          total_actions_attempted: number | null
          total_actions_failed: number | null
          total_actions_succeeded: number | null
          total_filtered: number | null
          total_searched: number | null
        }
        Relationships: []
      }
      v_post_performance: {
        Row: {
          account_handle: string | null
          account_name: string | null
          content: string | null
          created_at: string | null
          id: string | null
          like_count: number | null
          posted_at: string | null
          reply_count: number | null
          status: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_rate_limit_warnings: {
        Row: {
          endpoint: string | null
          limit_total: number | null
          remaining: number | null
          remaining_percent: number | null
          reset_at: string | null
          token_type: string | null
          updated_at: string | null
        }
        Insert: {
          endpoint?: string | null
          limit_total?: number | null
          remaining?: number | null
          remaining_percent?: never
          reset_at?: string | null
          token_type?: string | null
          updated_at?: string | null
        }
        Update: {
          endpoint?: string | null
          limit_total?: number | null
          remaining?: number | null
          remaining_percent?: never
          reset_at?: string | null
          token_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_recent_duplicate_attempts: {
        Row: {
          content: string | null
          created_at: string | null
          error_message: string | null
          text_hash: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_recent_engagement_executions: {
        Row: {
          action_types: string[] | null
          actions_attempted: number | null
          actions_failed: number | null
          actions_succeeded: number | null
          error_message: string | null
          executed_at: string | null
          filtered_count: number | null
          id: string | null
          rule_id: string | null
          rule_name: string | null
          search_type: string | null
          searched_count: number | null
          status: string | null
          target_tweet_ids: string[] | null
          target_user_ids: string[] | null
          trace_id: string | null
          used_account_ids: string[] | null
        }
        Relationships: []
      }
      v_rule_performance: {
        Row: {
          action_type: string | null
          actions_today: number | null
          daily_limit: number | null
          failure_count: number | null
          id: string | null
          is_active: boolean | null
          last_execution_at: string | null
          name: string | null
          next_execution_at: string | null
          search_type: string | null
          success_count: number | null
          success_rate: number | null
          total_actions_count: number | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          actions_today?: never
          daily_limit?: number | null
          failure_count?: number | null
          id?: string | null
          is_active?: boolean | null
          last_execution_at?: string | null
          name?: string | null
          next_execution_at?: never
          search_type?: string | null
          success_count?: number | null
          success_rate?: never
          total_actions_count?: number | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          actions_today?: never
          daily_limit?: number | null
          failure_count?: number | null
          id?: string | null
          is_active?: boolean | null
          last_execution_at?: string | null
          name?: string | null
          next_execution_at?: never
          search_type?: string | null
          success_count?: number | null
          success_rate?: never
          total_actions_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_engagement_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      acquire_loop_lock: {
        Args: { p_lock_duration_minutes?: number; p_loop_id: string }
        Returns: boolean
      }
      assign_proxy_to_account: {
        Args: {
          p_account_id: string
          p_account_table: string
          p_strategy?: string
          p_user_id: string
        }
        Returns: string
      }
      build_x_search_query: {
        Args: {
          p_base_query: string
          p_exclude_keywords?: string[]
          p_has_engagement?: boolean
          p_min_faves?: number
          p_min_replies?: number
          p_min_retweets?: number
          p_since?: string
          p_until?: string
        }
        Returns: string
      }
      bulk_assign_proxies: {
        Args: {
          p_account_ids: string[]
          p_account_table: string
          p_strategy?: string
          p_user_id: string
        }
        Returns: {
          account_id: string
          error_message: string
          proxy_id: string
          success: boolean
        }[]
      }
      cleanup_stale_loop_locks: { Args: never; Returns: number }
      get_active_cta_loops: {
        Args: { p_account_handle?: string }
        Returns: {
          executor_account_ids: string[]
          id: string
          last_processed_tweet_id: string
          loop_name: string
          monitor_account_handle: string
          template_ids: string[]
          user_id: string
        }[]
      }
      get_app_setting: { Args: { setting_key: string }; Returns: string }
      get_available_proxy: {
        Args: { p_strategy?: string; p_user_id: string }
        Returns: {
          assigned_accounts_count: number | null
          city: string | null
          country: string | null
          created_at: string | null
          error_message: string | null
          failure_count: number | null
          host: string | null
          id: string
          is_active: boolean | null
          last_checked_at: string | null
          last_tested_at: string | null
          last_used_at: string | null
          notes: string | null
          password: string | null
          port: number | null
          proxy_name: string | null
          proxy_type: string
          proxy_url: string
          response_time_ms: number | null
          tags: string[] | null
          test_status: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "proxies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_encryption_key: { Args: never; Returns: string }
      get_or_create_daily_stats: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_pending_engagement_rules: {
        Args: { p_limit?: number; p_user_id?: string }
        Returns: {
          action_type: string
          action_types: string[]
          actions_today: number
          allowed_account_tags: string[]
          daily_limit: number
          exclude_keywords: string[]
          exclude_verified: boolean
          executor_account_ids: string[]
          id: string
          is_active: boolean
          max_actions_per_execution: number
          max_followers: number
          min_account_age_days: number
          min_followers: number
          name: string
          reply_template_id: string
          require_verified: boolean
          search_query: string
          search_type: string
          user_id: string
        }[]
      }
      get_pending_loops: {
        Args: { p_limit?: number; p_loop_type?: string; p_user_id?: string }
        Returns: {
          allowed_account_tags: string[]
          description: string
          execution_count: number
          execution_interval_hours: number
          execution_interval_minutes: number
          executor_account_ids: string[]
          id: string
          is_active: boolean
          last_execution_at: string
          last_processed_tweet_id: string
          last_used_template_index: number
          loop_name: string
          loop_type: string
          max_accounts: number
          min_accounts: number
          monitor_account_handle: string
          next_execution_at: string
          post_count: number
          selection_mode: string
          target_type: string
          target_value: string
          template_ids: string[]
          user_id: string
        }[]
      }
      get_proxy_health_stats: {
        Args: { p_user_id: string }
        Returns: {
          active_proxies: number
          avg_failure_count: number
          healthy_proxies: number
          total_proxies: number
          unhealthy_proxies: number
        }[]
      }
      increment_daily_stat: {
        Args: { p_increment?: number; p_stat_name: string; p_user_id: string }
        Returns: undefined
      }
      log_execution: {
        Args: {
          p_account_ids?: string[]
          p_error_message?: string
          p_execution_type: string
          p_items_failed?: number
          p_items_processed?: number
          p_items_succeeded?: number
          p_result_data?: Json
          p_rule_id?: string
          p_status: string
          p_target_data?: Json
          p_user_id: string
        }
        Returns: string
      }
      release_loop_lock: { Args: { p_loop_id: string }; Returns: undefined }
      run_detect_followbacks: { Args: never; Returns: undefined }
      run_dispatch_dms: { Args: never; Returns: undefined }
      select_accounts_round_robin: {
        Args: {
          p_account_type: string
          p_limit?: number
          p_tag_filter?: string[]
          p_user_id: string
        }
        Returns: {
          account_handle: string
          account_id: string
        }[]
      }
      update_cta_loop_last_tweet: {
        Args: { p_loop_id: string; p_tweet_id: string }
        Returns: undefined
      }
      update_loop_execution_stats: {
        Args: {
          p_loop_id: string
          p_next_template_index?: number
          p_post_count?: number
        }
        Returns: undefined
      }
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
  public: {
    Enums: {},
  },
} as const
