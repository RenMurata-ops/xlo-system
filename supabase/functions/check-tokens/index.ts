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

    // Check all tokens
    const { data: tokens, error } = await sb
      .from('account_tokens')
      .select('id, x_username, is_active, token_type, expires_at, refresh_token')
      .eq('token_type', 'oauth2')
      .order('expires_at', { ascending: false });

    if (error) {
      throw error;
    }

    const now = new Date();
    const tokensWithStatus = tokens.map(token => {
      const expiresAt = new Date(token.expires_at);
      const timeRemaining = expiresAt.getTime() - now.getTime();
      const minutesRemaining = Math.floor(timeRemaining / 1000 / 60);

      return {
        x_username: token.x_username,
        is_active: token.is_active,
        expires_at: token.expires_at,
        minutes_remaining: minutesRemaining,
        expired: timeRemaining < 0,
        has_refresh_token: !!token.refresh_token,
        token_id: token.id,
      };
    });

    return new Response(
      JSON.stringify({ tokens: tokensWithStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
