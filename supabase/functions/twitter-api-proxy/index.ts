import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface ProxyRequest {
  user_id?: string;
  account_id?: string;
  x_user_id?: string;
  endpoint: string;
  method: string;
  params?: Record<string, any>;
  body?: any;
}

async function refreshAccessToken(
  supabase: any,
  tokenRecord: any
): Promise<string | null> {
  try {
    const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID')!;
    const twitterClientSecret = Deno.env.get('TWITTER_CLIENT_SECRET')!;

    const refreshParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRecord.refresh_token,
    });

    const basicAuth = btoa(`${twitterClientId}:${twitterClientSecret}`);

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: refreshParams.toString(),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const tokenData = await response.json();

    // Update token in database
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    await supabase
      .from('account_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || tokenRecord.refresh_token,
        expires_at: expiresAt.toISOString(),
        last_refreshed_at: new Date().toISOString(),
        refresh_count: (tokenRecord.refresh_count || 0) + 1,
      })
      .eq('id', tokenRecord.id);

    return tokenData.access_token;
  } catch (error) {
    console.error('Refresh token error:', error);
    return null;
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const requestData: ProxyRequest = await req.json();
    const { endpoint, method, params, body, x_user_id, account_id } = requestData;

    if (!endpoint || !method) {
      throw new Error('Missing endpoint or method');
    }

    // Find valid access token
    let query = supabase
      .from('account_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('token_type', 'oauth2')
      .eq('is_active', true);

    if (x_user_id) {
      query = query.eq('x_user_id', x_user_id);
    } else if (account_id) {
      query = query.eq('account_id', account_id);
    }

    const { data: tokens, error: tokenError } = await query.limit(1);

    if (tokenError || !tokens || tokens.length === 0) {
      throw new Error('No valid access token found');
    }

    let tokenRecord = tokens[0];
    let accessToken = tokenRecord.access_token;

    // Check if token needs refresh (expires in less than 5 minutes)
    const expiresAt = new Date(tokenRecord.expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt < fiveMinutesFromNow && tokenRecord.refresh_token) {
      console.log('Token expiring soon, refreshing...');
      const newToken = await refreshAccessToken(supabase, tokenRecord);
      if (newToken) {
        accessToken = newToken;
      }
    }

    // Build Twitter API URL
    const twitterUrl = new URL(`https://api.twitter.com${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        twitterUrl.searchParams.set(key, String(value));
      });
    }

    // Make request to Twitter API
    const twitterHeaders: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const twitterResponse = await fetch(twitterUrl.toString(), {
      method: method.toUpperCase(),
      headers: twitterHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = await twitterResponse.json();

    // Extract rate limit headers
    const rateLimitLimit = twitterResponse.headers.get('x-rate-limit-limit');
    const rateLimitRemaining = twitterResponse.headers.get('x-rate-limit-remaining');
    const rateLimitReset = twitterResponse.headers.get('x-rate-limit-reset');

    // Calculate rate limit warning
    const limit = parseInt(rateLimitLimit || '0');
    const remaining = parseInt(rateLimitRemaining || '0');
    const isLowRate = limit > 0 && (remaining / limit) < 0.2;

    // Record rate limit info
    if (rateLimitLimit && rateLimitRemaining && rateLimitReset) {
      const resetDate = new Date(parseInt(rateLimitReset) * 1000);

      await supabase
        .from('rate_limits')
        .upsert({
          user_id: user.id,
          endpoint,
          token_type: 'oauth2',
          limit_total: limit,
          remaining: remaining,
          reset_at: resetDate.toISOString(),
          used_requests: limit - remaining,
          window_started_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,endpoint,token_type,window_started_at',
        });
    }

    return new Response(
      JSON.stringify({
        success: twitterResponse.ok,
        status: twitterResponse.status,
        data: responseData,
        rateLimits: {
          limit: rateLimitLimit,
          remaining: rateLimitRemaining,
          reset: rateLimitReset,
          warning: isLowRate ? 'rate_limit_low' : null,
          remaining_percent: limit > 0 ? Math.round((remaining / limit) * 100) : 100,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: twitterResponse.ok ? 200 : twitterResponse.status,
      }
    );
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
