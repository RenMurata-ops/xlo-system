-- ============================================================================
-- Check XLO System Readiness for End-to-End Testing
-- ============================================================================

-- 1. Check active accounts with valid tokens
SELECT
  '1. Active Accounts with Valid Tokens' as check_category,
  COUNT(*) as count
FROM account_tokens
WHERE is_active = true
  AND token_type = 'oauth2'
  AND expires_at > NOW()
  AND access_token IS NOT NULL;

-- 2. Check active templates
SELECT
  '2. Active Templates' as check_category,
  template_type,
  COUNT(*) as count
FROM templates
WHERE is_active = true
GROUP BY template_type
ORDER BY template_type;

-- 3. Check active loops
SELECT
  '3. Active Loops' as check_category,
  COUNT(*) as count
FROM loops
WHERE is_active = true;

-- 4. Check active engagement rules
SELECT
  '4. Active Engagement Rules' as check_category,
  COUNT(*) as count
FROM auto_engagement_rules
WHERE is_active = true;

-- 5. Check pending targeted engagements
SELECT
  '5. Pending Targeted Engagements' as check_category,
  COUNT(*) as count
FROM targeted_engagements
WHERE status IN ('pending', 'running');

-- 6. Check cron jobs
SELECT
  '6. Active Cron Jobs' as check_category,
  jobname,
  schedule,
  active
FROM cron.job
WHERE active = true
ORDER BY jobname;

-- 7. List accounts with valid tokens
SELECT
  '7. Valid Token Details' as section,
  at.account_type,
  at.x_username,
  at.expires_at,
  (at.expires_at - NOW()) as time_until_expiry
FROM account_tokens at
WHERE at.is_active = true
  AND at.token_type = 'oauth2'
  AND at.expires_at > NOW()
ORDER BY at.account_type, at.x_username
LIMIT 5;

-- 8. List active loops with details
SELECT
  '8. Active Loop Details' as section,
  l.id,
  l.loop_name,
  l.loop_type,
  l.post_interval_minutes,
  l.template_ids,
  l.account_ids,
  l.next_post_at
FROM loops l
WHERE l.is_active = true
LIMIT 5;

-- 9. List active engagement rules
SELECT
  '9. Active Engagement Rules' as section,
  COALESCE(r.name, r.rule_name) as rule_name,
  r.search_type,
  r.search_query,
  r.action_types,
  r.daily_limit,
  r.actions_today
FROM auto_engagement_rules r
WHERE r.is_active = true
LIMIT 5;

SELECT '✅ System readiness check complete!' as result;
