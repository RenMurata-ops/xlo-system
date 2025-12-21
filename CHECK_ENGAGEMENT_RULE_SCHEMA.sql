-- Check auto_engagement_rules schema to identify the rule_type issue
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'auto_engagement_rules'
  AND column_name IN ('rule_type', 'search_type', 'rule_name', 'name')
ORDER BY column_name;
