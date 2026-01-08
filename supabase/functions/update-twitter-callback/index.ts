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

    // Get callback URL from request body, or construct from SUPABASE_URL
    const body = await req.json().catch(() => ({}));
    const newCallbackUrl = body.callback_url || `${supabaseUrl}/functions/v1/twitter-oauth-callback-v2`;

    const { error: updateError } = await sb
      .from('twitter_apps')
      .update({ callback_url: newCallbackUrl })
      .eq('is_active', true);

    if (updateError) {
      throw updateError;
    }

    const { data: apps, error: fetchError } = await sb
      .from('twitter_apps')
      .select('id, app_name, callback_url')
      .eq('is_active', true);

    if (fetchError) {
      throw fetchError;
    }

    return new Response(
      JSON.stringify({ success: true, apps, message: 'Callback URLs updated' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
