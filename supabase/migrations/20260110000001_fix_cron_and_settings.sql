-- Fix Cron Jobs and App Settings
-- Created: 2026-01-10
-- Purpose: Add missing Cron jobs and configure app settings for production

-- ============================================================================
-- 1. Add execute-auto-engagement Cron job (every 5 minutes)
-- ============================================================================
SELECT cron.schedule(
  'execute-auto-engagement',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/execute-auto-engagement',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================================
-- 2. Configure app.settings (these should be set via ALTER SYSTEM or config)
-- ============================================================================
-- NOTE: These settings MUST be configured in production environment
-- For local development, set these in postgresql.conf or via ALTER SYSTEM:
--
-- ALTER SYSTEM SET app.settings.supabase_url = 'http://127.0.0.1:54321';
-- ALTER SYSTEM SET app.settings.service_role_key = 'your-service-role-key-here';
-- SELECT pg_reload_conf();

-- Add helpful comment
-- NOTE: Commented out for local development due to permission issues
-- COMMENT ON SCHEMA cron IS 'Cron jobs for automated tasks - requires app.settings.supabase_url and app.settings.service_role_key to be configured';

-- ============================================================================
-- 3. Add safety check function for Cron jobs
-- ============================================================================
CREATE OR REPLACE FUNCTION check_cron_settings()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if required settings are configured
  BEGIN
    PERFORM current_setting('app.settings.supabase_url');
    PERFORM current_setting('app.settings.service_role_key');
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Cron settings not configured. Please set app.settings.supabase_url and app.settings.service_role_key';
    RETURN false;
  END;
END;
$$;

COMMENT ON FUNCTION check_cron_settings IS 'Checks if required Cron job settings are configured';
