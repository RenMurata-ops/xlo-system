import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { token_id } = await req.json();

    if (!token_id) {
      throw new Error('token_id is required');
    }

    // Get token record
    const { data: tokenRecord, error: tokenError } = await sb
      .from('account_tokens')
      .select('*')
      .eq('id', token_id)
      .single();

    if (tokenError || !tokenRecord) {
      throw new Error('Token not found');
    }

    if (!tokenRecord.refresh_token) {
      throw new Error('No refresh token available');
    }

    // Get Twitter App credentials
    const { data: twitterApp, error: appError } = await sb
      .from('twitter_apps')
      .select('client_id, client_secret')
      .eq('user_id', tokenRecord.user_id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (appError || !twitterApp) {
      throw new Error('Twitter App not found for user');
    }

    // Refresh the token
    const refreshParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRecord.refresh_token,
    });

    const basicAuth = btoa(`${twitterApp.client_id}:${twitterApp.client_secret}`);

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: refreshParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', errorText);
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    const tokenData = await response.json();

    // Update token in database
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const { error: updateError } = await sb
      .from('account_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || tokenRecord.refresh_token,
        expires_at: expiresAt.toISOString(),
        last_refreshed_at: new Date().toISOString(),
        refresh_count: (tokenRecord.refresh_count || 0) + 1,
        is_active: true,
      })
      .eq('id', token_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        x_username: tokenRecord.x_username,
        expires_at: expiresAt.toISOString(),
        refresh_count: (tokenRecord.refresh_count || 0) + 1,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
