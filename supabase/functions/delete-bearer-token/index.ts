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

    // Delete ALL tokens for BelviaCard60876
    const { error: deleteError } = await sb
      .from('account_tokens')
      .delete()
      .eq('x_username', 'BelviaCard60876');

    if (deleteError) {
      throw deleteError;
    }

    // Check remaining tokens
    const { data: remainingTokens, error: fetchError } = await sb
      .from('account_tokens')
      .select('id, x_username, is_active, expires_at')
      .eq('x_username', 'BelviaCard60876');

    if (fetchError) {
      throw fetchError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bearer token deleted successfully',
        remaining_tokens: remainingTokens,
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
