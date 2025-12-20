-- ============================================================================
-- Check all feature tables and dependencies
-- ============================================================================

-- 1. Check if targeted_engagements table exists
SELECT 'targeted_engagements' as table_name,
       CASE WHEN EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_name = 'targeted_engagements'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- 2. Check if auto_engagement_rules has all required columns
SELECT 'auto_engagement_rules columns' as check_name,
       CASE WHEN EXISTS (
         SELECT FROM information_schema.columns
         WHERE table_name = 'auto_engagement_rules'
         AND column_name = 'last_executed_at'
       ) THEN '✅ Has last_executed_at' ELSE '❌ Missing last_executed_at' END as status;

-- 3. Check if loops table has required columns
SELECT 'loops table' as check_name,
       CASE WHEN EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_name = 'loops'
       ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- 4. Check active engagement rules count
SELECT 'Active engagement rules' as metric,
       COUNT(*)::TEXT as count
FROM auto_engagement_rules
WHERE is_active = true;

-- 5. Check active loops count
SELECT 'Active loops' as metric,
       COUNT(*)::TEXT as count
FROM loops
WHERE is_active = true;

-- 6. Check active targeted engagements
SELECT 'Active targeted engagements' as metric,
       COALESCE(COUNT(*)::TEXT, '0') as count
FROM targeted_engagements
WHERE status IN ('pending', 'running');

-- 7. List all database functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%engagement%'
ORDER BY routine_name;
