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

    // Get failing rules
    const { data: rules, error: fetchError } = await sb
      .from('auto_engagement_rules')
      .select('id, name, search_type, search_query, is_active')
      .in('name', ['XTEP参加', '特定ツイートURL監視', '特定ユーザー監視'])
      .order('name');

    if (fetchError) {
      throw fetchError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        rules: rules,
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
