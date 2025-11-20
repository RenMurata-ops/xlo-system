-- Schedule the refresh-tokens function to run every 30 minutes
-- This ensures tokens are refreshed well before the 1-hour expiration window

-- First, enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Delete existing job if it exists
SELECT cron.unschedule('refresh-twitter-tokens');

-- Schedule the job to run every 30 minutes
SELECT cron.schedule(
  'refresh-twitter-tokens',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/refresh-tokens',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Alternative simpler approach using net extension directly
-- Run this if the above doesn't work

-- SELECT cron.schedule(
--   'refresh-twitter-tokens',
--   '*/30 * * * *',
--   $$
--   SELECT net.http_post(
--     'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens'::text,
--     '{}',
--     'application/json'
--   );
--   $$
-- );
