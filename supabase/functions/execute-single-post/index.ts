import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface SinglePostRequest {
  post_id: string;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      throw new Error('認証エラー: ログインしてください');
    }

    // Get service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: SinglePostRequest = await req.json();
    const { post_id } = requestData;

    if (!post_id) {
      throw new Error('Missing post_id');
    }

    // Get post details
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', post_id)
      .eq('user_id', user.id)
      .single();

    if (postError || !post) {
      console.error('Post fetch error:', postError);
      throw new Error('投稿が見つかりません');
    }

    // Check if post is already posted
    if (post.status === 'posted') {
      throw new Error('この投稿は既に投稿されています');
    }

    if (!post.content || post.content.trim() === '') {
      throw new Error('投稿内容が空です');
    }

    // Get account details to find x_user_id
    const { data: accountToken, error: tokenError } = await supabase
      .from('account_tokens')
      .select('x_user_id, access_token')
      .eq('account_id', post.account_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (tokenError || !accountToken) {
      console.error('Account token fetch error:', tokenError);
      throw new Error('アカウントのトークンが見つかりません。アカウントを再連携してください。');
    }

    // Update post status to processing
    await supabase
      .from('posts')
      .update({ status: 'processing' })
      .eq('id', post_id);

    // Post to Twitter via proxy
    const proxyResponse = await fetch(
      `${supabaseUrl}/functions/v1/twitter-api-proxy`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/2/tweets',
          method: 'POST',
          body: { text: post.content },
          x_user_id: accountToken.x_user_id,
          account_id: post.account_id,
        }),
      }
    );

    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text();
      console.error('Proxy response error:', errorText);
      throw new Error('Twitter APIへの接続に失敗しました');
    }

    const proxyResult = await proxyResponse.json();

    if (!proxyResult.success) {
      throw new Error(proxyResult.error || 'Twitter APIリクエストが失敗しました');
    }

    const tweetId = proxyResult.data?.data?.id;

    if (!tweetId) {
      throw new Error('Tweet IDを取得できませんでした');
    }

    // Update post with Twitter ID and status
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        status: 'posted',
        twitter_id: tweetId,
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', post_id);

    if (updateError) {
      console.error('Post update error:', updateError);
      throw new Error('投稿ステータスの更新に失敗しました');
    }

    return new Response(
      JSON.stringify({
        success: true,
        tweet_id: tweetId,
        post_id: post_id,
        message: '投稿が完了しました',
        trace_id: traceId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Single post execution error:', error);

    // Try to update post status to failed if we have the post_id
    try {
      const requestData = await req.json();
      const { post_id } = requestData;

      if (post_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from('posts')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', post_id);
      }
    } catch (updateError) {
      console.error('Failed to update post status:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        trace_id: traceId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
