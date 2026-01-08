-- Schedule periodic token refresh to keep account links alive
-- Safe variant that prefers secrets in Vault / app.settings; falls back to project URL

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: fetch secrets from vault/app.settings; if missing, skip scheduling
DO $$
DECLARE
  srv_key TEXT;
  base_url TEXT;
BEGIN
  -- Pick service_role key from vault first, then app.settings
  SELECT COALESCE(
           (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1),
           current_setting('app.settings.service_role_key', true)
         )
    INTO srv_key;

  IF srv_key IS NULL THEN
    RAISE NOTICE 'Service role key not set; skip refresh-tokens cron setup';
    RETURN;
  END IF;

  -- Supabase URL (Vault > app.settings > hard-coded project URL fallback)
  SELECT COALESCE(
           (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1),
           current_setting('app.settings.supabase_url', true),
           'https://swyiwqzlmozlqircyyzr.supabase.co'
         )
    INTO base_url;

  -- Recreate job idempotently
  PERFORM cron.unschedule('refresh-tokens-30min');

  PERFORM cron.schedule(
    'refresh-tokens-30min',
    '*/30 * * * *', -- every 30 minutes
    format(
      $tmpl$
      SELECT net.http_post(
        url := '%s/functions/v1/refresh-tokens',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
      $tmpl$,
      base_url,
      srv_key
    )
  );

  RAISE NOTICE 'refresh-tokens-30min scheduled against %', base_url;
END $$;

-- Show the job for verification
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'refresh-tokens-30min';
