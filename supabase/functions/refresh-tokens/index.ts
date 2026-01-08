import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateEnv, getRequiredEnv, fetchWithTimeout } from '../_shared/fetch-with-timeout.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

interface TokenRefreshResult {
  token_id: string;
  x_username: string;
  success: boolean;
  error?: string;
}

async function refreshSingleToken(
  supabase: any,
  tokenRecord: any,
  twitterApp: any
): Promise<TokenRefreshResult> {
  try {
    if (!tokenRecord.refresh_token) {
      return {
        token_id: tokenRecord.id,
        x_username: tokenRecord.x_username || 'unknown',
        success: false,
        error: 'No refresh token available',
      };
    }

    const refreshParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRecord.refresh_token,
    });

    const basicAuth = btoa(`${twitterApp.client_id}:${twitterApp.client_secret}`);

    const response = await fetchWithTimeout('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: refreshParams.toString(),
      timeout: 30000,
      maxRetries: 2,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Token refresh failed for ${tokenRecord.x_username}:`, errorText);

      // Mark token as inactive if refresh completely fails
      if (response.status === 400 || response.status === 401) {
        await supabase
          .from('account_tokens')
          .update({
            is_active: false,
            error_message: `Refresh failed: ${errorText}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tokenRecord.id);
      }

      return {
        token_id: tokenRecord.id,
        x_username: tokenRecord.x_username || 'unknown',
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const tokenData = await response.json();

    // Calculate new expiry time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Update token in database
    const { error: updateError } = await supabase
      .from('account_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || tokenRecord.refresh_token,
        expires_at: expiresAt.toISOString(),
        last_refreshed_at: new Date().toISOString(),
        refresh_count: (tokenRecord.refresh_count || 0) + 1,
        error_message: null,
        is_active: true,
      })
      .eq('id', tokenRecord.id);

    if (updateError) {
      console.error(`Failed to update token for ${tokenRecord.x_username}:`, updateError);
      return {
        token_id: tokenRecord.id,
        x_username: tokenRecord.x_username || 'unknown',
        success: false,
        error: `Database update failed: ${updateError.message}`,
      };
    }

    console.log(`Successfully refreshed token for ${tokenRecord.x_username}`);
    return {
      token_id: tokenRecord.id,
      x_username: tokenRecord.x_username || 'unknown',
      success: true,
    };
  } catch (error) {
    console.error(`Error refreshing token for ${tokenRecord.x_username}:`, error);
    return {
      token_id: tokenRecord.id,
      x_username: tokenRecord.x_username || 'unknown',
      success: false,
      error: error.message,
    };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const SUPABASE_URL = getRequiredEnv('SUPABASE_URL');
    const SERVICE_ROLE_KEY = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Calculate the time threshold (1 hour from now)
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

    // Find all tokens expiring within 1 hour
    // SECURITY: Only refresh active tokens to prevent reactivation of manually disabled tokens
    const { data: expiringTokens, error: tokensError } = await supabase
      .from('account_tokens')
      .select(`
        id,
        user_id,
        twitter_app_id,
        access_token,
        refresh_token,
        expires_at,
        x_username,
        account_type,
        refresh_count,
        is_active
      `)
      .eq('token_type', 'oauth2')
      .eq('is_active', true)
      .not('refresh_token', 'is', null)
      .lt('expires_at', oneHourFromNow.toISOString())
      .order('expires_at', { ascending: true });

    if (tokensError) {
      throw new Error(`Failed to fetch expiring tokens: ${tokensError.message}`);
    }

    if (!expiringTokens || expiringTokens.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'No tokens need refresh',
          refreshed: 0,
          failed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${expiringTokens.length} tokens to refresh`);

    // Get unique Twitter App IDs to fetch their credentials
    const appIds = [...new Set(expiringTokens.map(t => t.twitter_app_id).filter(id => id))];

    // Get unique user_ids for tokens without twitter_app_id (fallback)
    const userIdsNeedingDefault = [...new Set(
      expiringTokens
        .filter(t => !t.twitter_app_id)
        .map(t => t.user_id)
        .filter(id => id)
    )];

    // Fetch Twitter Apps by their IDs (not user_id) for multi-app support
    const { data: twitterApps, error: appsError } = await supabase
      .from('twitter_apps')
      .select('id, user_id, client_id, client_secret')
      .in('id', appIds)
      .eq('is_active', true);

    if (appsError) {
      throw new Error(`Failed to fetch Twitter Apps: ${appsError.message}`);
    }

    // Fetch default Twitter Apps for users without twitter_app_id
    let defaultApps = [];
    if (userIdsNeedingDefault.length > 0) {
      const { data: defaults, error: defaultsError } = await supabase
        .from('twitter_apps')
        .select('id, user_id, client_id, client_secret')
        .in('user_id', userIdsNeedingDefault)
        .eq('is_active', true)
        .eq('is_default', true);

      if (defaultsError) {
        console.warn('Failed to fetch default Twitter Apps:', defaultsError);
      } else {
        defaultApps = defaults || [];
      }

      // If no default apps found, try to get any active app for these users
      if (defaultApps.length === 0) {
        const { data: anyApps, error: anyAppsError } = await supabase
          .from('twitter_apps')
          .select('id, user_id, client_id, client_secret')
          .in('user_id', userIdsNeedingDefault)
          .eq('is_active', true)
          .limit(userIdsNeedingDefault.length);

        if (!anyAppsError && anyApps) {
          defaultApps = anyApps;
        }
      }
    }

    // Create a map of twitter_app_id to Twitter App (changed from user_id)
    const appMap = new Map();
    for (const app of twitterApps || []) {
      appMap.set(app.id, app);
    }

    // Create a map of user_id to default Twitter App (for fallback)
    const defaultAppMap = new Map();
    for (const app of defaultApps) {
      if (!defaultAppMap.has(app.user_id)) {
        defaultAppMap.set(app.user_id, app);
      }
    }

    const results: TokenRefreshResult[] = [];

    // Refresh each token
    for (const token of expiringTokens) {
      // Try to get Twitter App by twitter_app_id first
      let twitterApp = token.twitter_app_id ? appMap.get(token.twitter_app_id) : null;

      // Fallback: If twitter_app_id is null or not found, use default app for user
      if (!twitterApp && token.user_id) {
        twitterApp = defaultAppMap.get(token.user_id);
        if (twitterApp) {
          console.log(`Using fallback Twitter App for token ${token.id} (user: ${token.user_id})`);

          // Update the token with the twitter_app_id for future use
          await supabase
            .from('account_tokens')
            .update({ twitter_app_id: twitterApp.id })
            .eq('id', token.id);
        }
      }

      if (!twitterApp || !twitterApp.client_id || !twitterApp.client_secret) {
        results.push({
          token_id: token.id,
          x_username: token.x_username || 'unknown',
          success: false,
          error: 'No Twitter App credentials found for user',
        });
        continue;
      }

      const result = await refreshSingleToken(supabase, token, twitterApp);
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Token refresh complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Refreshed ${successful} tokens, ${failed} failed`,
        refreshed: successful,
        failed: failed,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
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
