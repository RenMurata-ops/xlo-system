-- Check auto_engagement_executions table schema
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'auto_engagement_executions'
ORDER BY ordinal_position;
