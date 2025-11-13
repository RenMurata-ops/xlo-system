// comprehensive-token-refresh - Comprehensive token validation and refresh
// Purpose: Validate and refresh all tokens, including connection tests
// Execution: Manual or weekly Cron

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface ComprehensiveResult {
  account_id: string;
  x_username: string;
  x_user_id: string;
  token_type: string;
  validation_status: 'valid' | 'expired' | 'invalid' | 'suspended';
  refresh_status?: 'success' | 'failed' | 'skipped';
  connection_test: 'passed' | 'failed';
  error?: string;
}

async function validateAndRefreshToken(
  supabase: any,
  token: any
): Promise<ComprehensiveResult> {
  const result: ComprehensiveResult = {
    account_id: token.id,
    x_username: token.x_username,
    x_user_id: token.x_user_id,
    token_type: token.token_type,
    validation_status: 'valid',
    connection_test: 'failed',
  };

  try {
    // Test current token
    const testResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
      },
    });

    if (testResponse.ok) {
      // Token is valid
      result.validation_status = 'valid';
      result.connection_test = 'passed';

      const userData = await testResponse.json();
      const twitterUser = userData.data;

      // Update profile info
      await supabase
        .from('account_tokens')
        .update({
          twitter_display_name: twitterUser.name || null,
          is_active: true,
          is_suspended: false,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', token.id);

      return result;
    }

    // Token is invalid or expired
    const errorData = await testResponse.json();

    // Check if account is suspended
    if (testResponse.status === 403 || errorData.title === 'Forbidden') {
      result.validation_status = 'suspended';
      result.error = 'Account suspended by Twitter';

      await supabase
        .from('account_tokens')
        .update({
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_reason: 'Account suspended by Twitter',
          is_active: false,
        })
        .eq('id', token.id);

      return result;
    }

    // Try to refresh if OAuth2
    if (token.token_type === 'oauth2' && token.refresh_token) {
      result.validation_status = 'expired';

      // IMPORTANT: Get Twitter App credentials from database, not environment variables
      // This ensures multi-tenant support where each user has their own Twitter App
      if (!token.app_id) {
        result.validation_status = 'invalid';
        result.error_message = 'No app_id found in token';
        return result;
      }

      // Get Twitter App from database
      const { data: twitterApp, error: appError } = await supabase
        .from('twitter_apps')
        .select('api_key, api_secret')
        .eq('id', token.app_id)
        .single();

      if (appError || !twitterApp) {
        result.validation_status = 'invalid';
        result.error_message = 'Failed to fetch Twitter App credentials';
        return result;
      }

      const twitterClientId = twitterApp.api_key;
      const twitterClientSecret = twitterApp.api_secret;

      const tokenParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
        client_id: twitterClientId,
      });

      const basicAuth = btoa(`${twitterClientId}:${twitterClientSecret}`);

      const refreshResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: tokenParams.toString(),
      });

      if (refreshResponse.ok) {
        const newTokenData = await refreshResponse.json();
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in);

        await supabase
          .from('account_tokens')
          .update({
            access_token: newTokenData.access_token,
            refresh_token: newTokenData.refresh_token || token.refresh_token,
            expires_at: expiresAt.toISOString(),
            last_refreshed_at: new Date().toISOString(),
            refresh_count: (token.refresh_count || 0) + 1,
            is_active: true,
            error_message: null,
          })
          .eq('id', token.id);

        // Test new token
        const retestResponse = await fetch('https://api.twitter.com/2/users/me', {
          headers: {
            'Authorization': `Bearer ${newTokenData.access_token}`,
          },
        });

        if (retestResponse.ok) {
          result.refresh_status = 'success';
          result.connection_test = 'passed';
        } else {
          result.refresh_status = 'success';
          result.connection_test = 'failed';
          result.error = 'Token refreshed but connection test failed';
        }

        return result;
      } else {
        result.refresh_status = 'failed';
        result.validation_status = 'invalid';
        result.error = await refreshResponse.text();

        await supabase
          .from('account_tokens')
          .update({
            is_active: false,
            error_message: result.error,
          })
          .eq('id', token.id);

        return result;
      }
    }

    // OAuth 1.0a or no refresh token
    result.validation_status = 'invalid';
    result.error = 'Token validation failed';

    await supabase
      .from('account_tokens')
      .update({
        is_active: false,
        error_message: JSON.stringify(errorData),
      })
      .eq('id', token.id);

    return result;

  } catch (error) {
    result.validation_status = 'invalid';
    result.error = error.message;
    return result;
  }
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body for optional user_id filter
    let userId: string | null = null;
    try {
      const body = await req.json();
      userId = body.user_id || null;
    } catch {
      // No body, process all users
    }

    // Get all tokens (optionally filtered by user)
    let query = supabase
      .from('account_tokens')
      .select('*')
      .order('x_username', { ascending: true });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: tokens, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No tokens found',
          results: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Processing ${tokens.length} tokens...`);

    // Process in batches of 3 (to avoid rate limits)
    const batchSize = 3;
    const results: ComprehensiveResult[] = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tokens.length / batchSize)}`);

      const batchResults = await Promise.all(
        batch.map(token => validateAndRefreshToken(supabase, token))
      );
      results.push(...batchResults);

      // Wait 1 second between batches
      if (i + batchSize < tokens.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Aggregate statistics
    const stats = {
      total: results.length,
      valid: results.filter(r => r.validation_status === 'valid').length,
      expired_refreshed: results.filter(r => r.refresh_status === 'success').length,
      invalid: results.filter(r => r.validation_status === 'invalid').length,
      suspended: results.filter(r => r.validation_status === 'suspended').length,
      connection_passed: results.filter(r => r.connection_test === 'passed').length,
    };

    // Send summary notification for each user
    const userResults = new Map<string, ComprehensiveResult[]>();
    for (const result of results) {
      const token = tokens.find(t => t.id === result.account_id);
      if (token) {
        if (!userResults.has(token.user_id)) {
          userResults.set(token.user_id, []);
        }
        userResults.get(token.user_id)!.push(result);
      }
    }

    for (const [uid, userTokens] of userResults.entries()) {
      const invalidCount = userTokens.filter(r => r.validation_status === 'invalid').length;
      const suspendedCount = userTokens.filter(r => r.validation_status === 'suspended').length;

      if (invalidCount > 0 || suspendedCount > 0) {
        await supabase.from('notifications').insert({
          user_id: uid,
          title: 'Token Validation Report',
          message: `${invalidCount} invalid token(s), ${suspendedCount} suspended account(s)`,
          type: invalidCount > 0 || suspendedCount > 0 ? 'warning' : 'info',
          priority: 'medium',
          category: 'account',
          action_url: '/accounts/main',
          action_label: 'Review Accounts',
        });
      }
    }

    console.log('Comprehensive refresh complete:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Comprehensive token refresh completed',
        stats,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in comprehensive-token-refresh:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
