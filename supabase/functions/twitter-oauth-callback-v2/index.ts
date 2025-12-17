import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateEnv, getRequiredEnv } from '../_shared/fetch-with-timeout.ts';

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

    // Validate required environment variables
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

    // Initialize Supabase with service role key (admin access)
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
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

    // Fetch Twitter App credentials from database
    const { data: twitterApp, error: appError } = await supabase
      .from('twitter_apps')
      .select('client_id, client_secret, callback_url')
      .eq('id', session.twitter_app_id)
      .single();

    if (appError || !twitterApp) {
      console.error('Twitter App fetch error:', appError);
      return Response.redirect(
        `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=app_not_found`,
        302
      );
    }

    if (!twitterApp.client_id || !twitterApp.client_secret) {
      return Response.redirect(
        `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=invalid_credentials`,
        302
      );
    }

    // Exchange code for access token
    const twitterClientId = twitterApp.client_id;
    const twitterClientSecret = twitterApp.client_secret;
    const supabaseUrlForCallback = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrlForCallback && !twitterApp.callback_url) {
      console.error('SUPABASE_URL is not set and no callback_url configured');
      return Response.redirect(
        `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=missing_callback_url`,
        302
      );
    }
    const twitterRedirectUri = twitterApp.callback_url ||
      `${supabaseUrlForCallback}/functions/v1/twitter-oauth-callback-v2`;

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

    // Get user info from Twitter with full profile data
    const userFields = 'id,name,username,profile_image_url,public_metrics,verified';
    const userResponse = await fetch(`https://api.twitter.com/2/users/me?user.fields=${userFields}`, {
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

    // Extract profile metrics
    const followerCount = twitterUser.public_metrics?.followers_count || 0;
    const followingCount = twitterUser.public_metrics?.following_count || 0;
    const isVerified = twitterUser.verified || false;

    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Upsert to account_tokens with account linking
    const { error: upsertError } = await supabase
      .from('account_tokens')
      .upsert({
        user_id: session.user_id,
        account_type: session.account_type || 'main',
        account_id: session.account_id || null,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_type: 'oauth2',
        expires_at: expiresAt.toISOString(),
        scope: tokenData.scope || 'tweet.read tweet.write users.read offline.access',
        x_user_id: twitterUser.id,
        x_username: twitterUser.username,
        display_name: twitterUser.name || twitterUser.username,
        twitter_display_name: twitterUser.name || null,
        profile_image_url: twitterUser.profile_image_url || null,
        followers_count: followerCount,
        following_count: followingCount,
        is_active: true,
        is_verified: isVerified,
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

    // Update the account table with profile info
    if (session.account_id) {
      let accountTable = 'main_accounts';
      if (session.account_type === 'spam') {
        accountTable = 'spam_accounts';
      } else if (session.account_type === 'follow') {
        accountTable = 'follow_accounts';
      }

      const { error: updateError } = await supabase
        .from(accountTable)
        .update({
          name: twitterUser.name || twitterUser.username,
          follower_count: followerCount,
          following_count: followingCount,
          is_verified: isVerified,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.account_id);

      if (updateError) {
        console.error('Account update error:', updateError);
        // Don't fail the whole process, just log the error
      }
    }

    // Delete oauth session
    await supabase
      .from('oauth_sessions')
      .delete()
      .eq('id', session.id);

    // Redirect to appropriate page based on account type
    const baseUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';
    let redirectPath = '/accounts/main';

    if (session.account_type === 'spam') {
      redirectPath = '/accounts/spam';
    } else if (session.account_type === 'follow') {
      redirectPath = '/accounts/follow';
    }

    // Build redirect URL with optional account_id
    const redirectUrl = new URL(`${baseUrl}${redirectPath}`);
    redirectUrl.searchParams.set('connected', '1');
    if (session.account_id) {
      redirectUrl.searchParams.set('account_id', session.account_id);
    }

    return Response.redirect(redirectUrl.toString(), 302);
  } catch (error) {
    console.error('Callback error:', error);
    return Response.redirect(
      `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/twitter-apps?error=unexpected_error`,
      302
    );
  }
});
