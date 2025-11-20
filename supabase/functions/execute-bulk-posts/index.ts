import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface BulkPostRequest {
  user_id: string;
  batch_size?: number;
  dryRun?: boolean;
}

interface ProcessedPost {
  queue_id: string;
  tweet_id?: string;
  text: string;
  status: 'success' | 'failed';
  error?: string;
}

// Weighted random selection
function selectByWeight<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Generate trace_id for debugging
  const traceId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: BulkPostRequest = await req.json();
    const { user_id, batch_size = 10, dryRun = false } = requestData;

    if (!user_id) {
      throw new Error('Missing user_id');
    }

    // Get pending posts from queue with lock
    const { data: queueItems, error: queueError } = await supabase
      .rpc('get_pending_bulk_posts', {
        p_user_id: user_id,
        p_batch_size: batch_size,
      });

    if (queueError) {
      console.error('Queue fetch error:', queueError);
      throw new Error('Failed to fetch queue items');
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          succeeded: 0,
          failed: 0,
          samples: [],
          message: 'No pending posts in queue',
          trace_id: traceId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const processedPosts: ProcessedPost[] = [];
    let succeeded = 0;
    let failed = 0;

    // Process each queue item
    for (const queueItem of queueItems) {
      try {
        // Mark as processing
        await supabase
          .from('bulk_post_queue')
          .update({ status: 'processing' })
          .eq('id', queueItem.id);

        let content = queueItem.generated_content;

        // Generate content if not already generated
        if (!content && queueItem.template_id) {
          // Get template
          const { data: template, error: templateError } = await supabase
            .from('post_templates')
            .select('*')
            .eq('id', queueItem.template_id)
            .eq('is_active', true)
            .single();

          if (templateError || !template) {
            throw new Error('Template not found or inactive');
          }

          // Get template items
          if (queueItem.use_template_items) {
            const { data: items, error: itemsError } = await supabase
              .from('post_template_items')
              .select('*')
              .eq('template_id', queueItem.template_id)
              .eq('is_active', true);

            if (itemsError || !items || items.length === 0) {
              throw new Error('No active template items found');
            }

            // Select item by weight
            const selectedItem = selectByWeight(items);
            content = selectedItem.content;

            // Update usage count
            await supabase
              .from('post_template_items')
              .update({ usage_count: selectedItem.usage_count + 1 })
              .eq('id', selectedItem.id);
          } else {
            content = template.content;
          }

          // Add CTA if requested
          if (queueItem.use_cta && queueItem.cta_template_id) {
            const { data: cta, error: ctaError } = await supabase
              .from('cta_templates')
              .select('*')
              .eq('id', queueItem.cta_template_id)
              .eq('is_active', true)
              .single();

            if (!ctaError && cta) {
              content = `${content}\n\n${cta.content}`;

              // Update CTA usage count
              await supabase
                .from('cta_templates')
                .update({ usage_count: cta.usage_count + 1 })
                .eq('id', cta.id);
            }
          }

          // Update template usage count
          await supabase
            .from('post_templates')
            .update({ usage_count: template.usage_count + 1 })
            .eq('id', template.id);

          // Save generated content
          await supabase
            .from('bulk_post_queue')
            .update({ generated_content: content })
            .eq('id', queueItem.id);
        }

        if (!content) {
          throw new Error('No content generated');
        }

        // Dry run - just return generated content
        if (dryRun) {
          processedPosts.push({
            queue_id: queueItem.id,
            text: content,
            status: 'success',
          });

          await supabase
            .from('bulk_post_queue')
            .update({ status: 'pending' })
            .eq('id', queueItem.id);

          succeeded++;
          continue;
        }

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
              body: { text: content },
              x_user_id: queueItem.target_x_user_id,
              account_id: queueItem.target_account_id,
            }),
          }
        );

        const proxyResult = await proxyResponse.json();

        if (!proxyResult.success) {
          throw new Error(proxyResult.error || 'Twitter API request failed');
        }

        const tweetId = proxyResult.data?.data?.id;

        // Calculate text_hash for duplicate detection
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const textHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Create post record
        const { data: post, error: postError } = await supabase
          .from('posts')
          .insert({
            user_id: user_id,
            account_id: queueItem.target_account_id,
            content: content,
            text_hash: textHash,
            tweet_id: tweetId,
            posted_at: new Date().toISOString(),
            status: 'posted',
            tags: queueItem.tags || [],
          })
          .select()
          .single();

        if (postError) {
          console.error('Post insert error:', postError);

          // Check if it's a duplicate post error
          if (postError.message?.includes('Duplicate post within 24h')) {
            throw new Error(`Duplicate post detected: ${postError.message}`);
          }
        }

        // Update queue item
        await supabase
          .from('bulk_post_queue')
          .update({
            status: 'success',
            tweet_id: tweetId,
            post_id: post?.id,
            executed_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id);

        processedPosts.push({
          queue_id: queueItem.id,
          tweet_id: tweetId,
          text: content,
          status: 'success',
        });

        succeeded++;
      } catch (error) {
        console.error(`Error processing queue item ${queueItem.id}:`, error);

        const errorMessage = error.message || 'Unknown error';
        const retryCount = queueItem.retry_count + 1;
        const shouldRetry = retryCount < queueItem.max_retries;

        // Update queue item with error
        await supabase
          .from('bulk_post_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            error_json: { error: errorMessage, timestamp: new Date().toISOString() },
            retry_count: retryCount,
            next_retry_at: shouldRetry
              ? new Date(Date.now() + Math.pow(2, retryCount) * 60000).toISOString()
              : null,
          })
          .eq('id', queueItem.id);

        processedPosts.push({
          queue_id: queueItem.id,
          text: queueItem.generated_content || 'Content generation failed',
          status: 'failed',
          error: errorMessage,
        });

        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedPosts.length,
        succeeded,
        failed,
        samples: processedPosts.slice(0, 5), // Return first 5 samples
        dryRun,
        trace_id: traceId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Bulk post execution error:', error);
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
