export interface Database {
  public: {
    Tables: {
      account_tokens: {
        Row: {
          id: string
          user_id: string
          account_type: 'main' | 'follow' | 'spam'
          account_id: string
          access_token: string
          access_token_secret: string | null
          refresh_token: string | null
          token_type: 'oauth1a' | 'oauth2'
          expires_at: string | null
          scope: string | null
          x_user_id: string
          x_username: string
          display_name: string | null
          twitter_display_name: string | null
          profile_image_url: string | null
          followers_count: number | null
          following_count: number | null
          is_active: boolean
          is_verified: boolean
          is_suspended: boolean
          suspended_at: string | null
          suspended_reason: string | null
          last_refreshed_at: string | null
          refresh_count: number
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['account_tokens']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['account_tokens']['Insert']>
      }
      main_accounts: {
        Row: {
          id: string
          user_id: string
          handle: string
          name: string
          followers_count: number
          following_count: number
          is_active: boolean
          last_activity_at: string | null
          is_verified: boolean
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['main_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['main_accounts']['Insert']>
      }
      posts: {
        Row: {
          id: string
          user_id: string
          account_id: string
          content: string
          media_urls: string[] | null
          scheduled_at: string | null
          posted_at: string | null
          engagement_count: number
          status: 'draft' | 'scheduled' | 'posted' | 'failed'
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['posts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['posts']['Insert']>
      }
    }
  }
}
