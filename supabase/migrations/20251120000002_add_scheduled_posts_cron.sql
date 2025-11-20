-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the execution of scheduled posts every minute
-- This will call the execute-scheduled-posts Edge Function
SELECT cron.schedule(
  'execute-scheduled-posts',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/execute-scheduled-posts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Store Supabase settings for cron job
-- Note: These need to be set manually via Supabase Dashboard or CLI
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

-- Comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Scheduled posts are executed every minute via execute-scheduled-posts Edge Function';
