-- Check if rate_limits table exists and its structure
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'rate_limits'
ORDER BY ordinal_position;

-- If table exists, show a sample
SELECT * FROM rate_limits LIMIT 1;
