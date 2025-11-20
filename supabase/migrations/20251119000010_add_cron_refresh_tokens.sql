-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the refresh-tokens function to run every 30 minutes
-- This ensures tokens are refreshed well before the 1-hour expiration window
SELECT cron.schedule(
  'refresh-twitter-tokens',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
