import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateEnv, getRequiredEnv, fetchWithTimeout } from '../_shared/fetch-with-timeout.ts';

interface SyncResult {
  token_id: string;
  x_username: string;
  success: boolean;
  followers_count?: number;
  following_count?: number;
  error?: string;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const SUPABASE_URL = getRequiredEnv('SUPABASE_URL');
    const SERVICE_ROLE_KEY = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get all active tokens with valid access tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('account_tokens')
      .select(`
        id,
        user_id,
        access_token,
        x_user_id,
        x_username,
        account_type,
        account_id,
        expires_at
      `)
      .eq('token_type', 'oauth2')
      .eq('is_active', true)
      .not('access_token', 'is', null);

    if (tokensError) {
      throw new Error(`Failed to fetch tokens: ${tokensError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'No tokens to sync',
          synced: 0,
          failed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${tokens.length} tokens to sync follower counts`);

    const results: SyncResult[] = [];

    for (const token of tokens) {
      try {
        // Check if token is expired
        if (new Date(token.expires_at) < new Date()) {
          results.push({
            token_id: token.id,
            x_username: token.x_username || 'unknown',
            success: false,
            error: 'Token expired',
          });
          continue;
        }

        // Fetch user data from Twitter API
        const userFields = 'public_metrics,verified';
        const response = await fetchWithTimeout(
          `https://api.twitter.com/2/users/me?user.fields=${userFields}`,
          {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
            },
            timeout: 30000,
            maxRetries: 2,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Twitter API error for ${token.x_username}:`, errorText);

          results.push({
            token_id: token.id,
            x_username: token.x_username || 'unknown',
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
          });
          continue;
        }

        const userData = await response.json();
        const twitterUser = userData.data;

        const followersCount = twitterUser.public_metrics?.followers_count || 0;
        const followingCount = twitterUser.public_metrics?.following_count || 0;
        const isVerified = twitterUser.verified || false;

        // Update account_tokens table
        await supabase
          .from('account_tokens')
          .update({
            followers_count: followersCount,
            following_count: followingCount,
            is_verified: isVerified,
            updated_at: new Date().toISOString(),
          })
          .eq('id', token.id);

        // Update the corresponding account table
        if (token.account_id) {
          let accountTable = 'main_accounts';
          if (token.account_type === 'spam') {
            accountTable = 'spam_accounts';
          } else if (token.account_type === 'follow') {
            accountTable = 'follow_accounts';
          }

          await supabase
            .from(accountTable)
            .update({
              follower_count: followersCount,
              following_count: followingCount,
              is_verified: isVerified,
              updated_at: new Date().toISOString(),
            })
            .eq('id', token.account_id);
        }

        console.log(`Synced ${token.x_username}: ${followersCount} followers, ${followingCount} following`);

        results.push({
          token_id: token.id,
          x_username: token.x_username || 'unknown',
          success: true,
          followers_count: followersCount,
          following_count: followingCount,
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error syncing ${token.x_username}:`, error);
        results.push({
          token_id: token.id,
          x_username: token.x_username || 'unknown',
          success: false,
          error: error.message,
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Follower sync complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Synced ${successful} accounts, ${failed} failed`,
        synced: successful,
        failed: failed,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Follower sync error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
