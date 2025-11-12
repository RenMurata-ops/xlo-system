import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

    // Call execute-loop function
    const url = `${SUPABASE_URL}/functions/v1/execute-loop`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    });

    const json = await res.json();

    console.log('Loop execution result:', json);

    return new Response(
      JSON.stringify({
        ok: true,
        forwarded: json,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Schedule loop execution error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 500,
      }
    );
  }
});
