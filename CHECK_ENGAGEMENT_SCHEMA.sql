-- auto_engagement_rulesのスキーマを確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'auto_engagement_rules'
  AND column_name IN ('name', 'rule_name')
ORDER BY column_name;

-- 制約も確認
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'auto_engagement_rules'::regclass
  AND contype = 'c'; -- check constraints
