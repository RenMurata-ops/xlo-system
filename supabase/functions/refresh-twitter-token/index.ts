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

    // Get BelviaCard60876's expired token with refresh_token
    const { data: expiredToken, error: fetchError } = await sb
      .from('account_tokens')
      .select('*, twitter_apps!inner(*)')
      .eq('x_username', 'BelviaCard60876')
      .not('refresh_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !expiredToken) {
      throw new Error('No token with refresh_token found');
    }

    const twitterApp = expiredToken.twitter_apps;

    // Refresh the access token using refresh_token
    const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
    const basicAuth = btoa(`${twitterApp.client_id}:${twitterApp.client_secret}`);

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: expiredToken.refresh_token,
        client_id: twitterApp.client_id,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Twitter API error: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    // Calculate expiration time (2 hours from now)
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    // Update the token in database
    const { error: updateError } = await sb
      .from('account_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || expiredToken.refresh_token,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', expiredToken.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token refreshed successfully',
        x_username: expiredToken.x_username,
        expires_at: expiresAt.toISOString(),
        expires_in_seconds: tokenData.expires_in,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
