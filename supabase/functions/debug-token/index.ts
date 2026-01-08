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

    // Get BelviaCard60876's tokens with all fields
    const { data: tokens, error: fetchError } = await sb
      .from('account_tokens')
      .select('*')
      .eq('x_username', 'BelviaCard60876');

    if (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      throw new Error('No tokens found');
    }

    // Hide sensitive fields
    const sanitizedTokens = tokens.map(token => {
      const { access_token, refresh_token, ...rest } = token as any;
      return {
        ...rest,
        has_refresh_token: !!refresh_token,
        refresh_token_length: refresh_token ? refresh_token.length : 0,
        refresh_token_preview: refresh_token ? refresh_token.substring(0, 10) + '...' : null,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        count: tokens.length,
        tokens: sanitizedTokens,
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
