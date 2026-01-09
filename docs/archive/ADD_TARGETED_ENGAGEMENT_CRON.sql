-- ============================================================================
-- Add Targeted Engagement to Cron Jobs
-- Schedule the execute-targeted-engagement function to run every 5 minutes
-- ============================================================================

-- Add cron job for targeted engagement execution (every 5 minutes)
SELECT cron.schedule(
  'execute-targeted-engagement',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-targeted-engagement',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MzI4NjYsImV4cCI6MjA3ODMwODg2Nn0.MIbwT2_YIeCCVHjLF2fBFrTSpyvL7jnrqkj3sb7GMgE'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) AS request_id;
  $$
);

-- Verification: List all cron jobs
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
ORDER BY jobname;

SELECT '✅ Targeted engagement cron job added!' as result;
