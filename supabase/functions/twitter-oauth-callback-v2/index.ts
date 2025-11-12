import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle error from Twitter
    if (error) {
      return Response.redirect(
        `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=${error}`,
        302
      );
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // Initialize Supabase with service role key (admin access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Retrieve oauth session by state
    const { data: session, error: sessionError } = await supabase
      .from('oauth_sessions')
      .select('*')
      .eq('state', state)
      .single();

    if (sessionError || !session) {
      console.error('Session error:', sessionError);
      return Response.redirect(
        `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=invalid_state`,
        302
      );
    }

    // Check session expiry
    if (new Date(session.expires_at) < new Date()) {
      return Response.redirect(
        `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=session_expired`,
        302
      );
    }

    // Exchange code for access token
    const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID')!;
    const twitterClientSecret = Deno.env.get('TWITTER_CLIENT_SECRET')!;
    const twitterRedirectUri = Deno.env.get('TWITTER_REDIRECT_URI')!;

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: twitterRedirectUri,
      code_verifier: session.code_verifier,
    });

    const basicAuth = btoa(`${twitterClientId}:${twitterClientSecret}`);

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange error:', errorData);
      return Response.redirect(
        `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=token_exchange_failed`,
        302
      );
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Twitter
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('User fetch error:', await userResponse.text());
      return Response.redirect(
        `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=user_fetch_failed`,
        302
      );
    }

    const userData = await userResponse.json();
    const twitterUser = userData.data;

    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Upsert to account_tokens
    const { error: upsertError } = await supabase
      .from('account_tokens')
      .upsert({
        user_id: session.user_id,
        account_type: 'main', // Default to main account
        account_id: null,     // Can be linked later
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_type: 'oauth2',
        expires_at: expiresAt.toISOString(),
        scope: tokenData.scope || 'tweet.read tweet.write users.read offline.access',
        x_user_id: twitterUser.id,
        x_username: twitterUser.username,
        display_name: twitterUser.name || twitterUser.username,
        twitter_display_name: twitterUser.name || null,
        is_active: true,
        last_refreshed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,x_user_id,account_type',
      });

    if (upsertError) {
      console.error('Token save error:', upsertError);
      return Response.redirect(
        `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=token_save_failed`,
        302
      );
    }

    // Delete oauth session
    await supabase
      .from('oauth_sessions')
      .delete()
      .eq('id', session.id);

    // Redirect to success page
    return Response.redirect(
      `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/accounts/main?connected=1`,
      302
    );
  } catch (error) {
    console.error('Callback error:', error);
    return Response.redirect(
      `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=unexpected_error`,
      302
    );
  }
});
