-- 本番環境の状態確認クエリ
-- Supabase SQL Editor で実行してください

-- ==========================================
-- 1. CORS: ALLOWED_ORIGINS 設定確認
-- ==========================================
-- ✅ CLI で確認済み: ALLOWED_ORIGINS は設定されています
-- 値: eb21d9473194e64c9219d7c9c3de439a53f6cd431dddc3ef0bde4e7932720c4c (暗号化済み)

-- ==========================================
-- 2. トークン: is_active=true の確認
-- ==========================================

-- アクティブなトークンの数を確認
SELECT
  account_type,
  COUNT(*) as active_token_count,
  STRING_AGG(x_username, ', ') as usernames
FROM account_tokens
WHERE is_active = true
  AND token_type = 'oauth2'
GROUP BY account_type
ORDER BY account_type;

-- 詳細情報（有効期限も含む）
SELECT
  id,
  x_username,
  account_type,
  is_active,
  expires_at,
  CASE
    WHEN expires_at < NOW() THEN '🔴 期限切れ'
    WHEN expires_at < NOW() + INTERVAL '1 hour' THEN '⚠️ 1時間以内に期限切れ'
    WHEN expires_at < NOW() + INTERVAL '24 hours' THEN '🟡 24時間以内に期限切れ'
    ELSE '✅ 正常'
  END as status,
  last_refreshed_at,
  refresh_count,
  error_message
FROM account_tokens
WHERE token_type = 'oauth2'
ORDER BY is_active DESC, expires_at ASC;

-- アラート: アクティブなトークンが0件の場合
DO $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM account_tokens
  WHERE is_active = true AND token_type = 'oauth2';

  IF active_count = 0 THEN
    RAISE WARNING '🚨 アラート: アクティブなトークンが0件です。すぐに再認証してください！';
  ELSIF active_count < 3 THEN
    RAISE WARNING '⚠️ 注意: アクティブなトークンが % 件のみです。', active_count;
  ELSE
    RAISE NOTICE '✅ アクティブなトークン: % 件', active_count;
  END IF;
END $$;

-- ==========================================
-- 3. エンゲージメント: 429 エラーの確認
-- ==========================================

-- 過去24時間のエンゲージメント実行履歴
SELECT
  DATE_TRUNC('hour', executed_at) as hour,
  status,
  COUNT(*) as execution_count,
  COUNT(*) FILTER (WHERE error_message LIKE '%429%' OR error_message LIKE '%rate limit%') as rate_limit_errors,
  COUNT(*) FILTER (WHERE success = false) as total_errors,
  ROUND(
    (COUNT(*) FILTER (WHERE error_message LIKE '%429%')::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) as rate_limit_error_percent
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', executed_at), status
ORDER BY hour DESC;

-- 429 エラーの詳細
SELECT
  rule_id,
  executed_at,
  status,
  error_message,
  execution_time_ms
FROM auto_engagement_executions
WHERE (error_message LIKE '%429%' OR error_message LIKE '%rate limit%')
  AND executed_at > NOW() - INTERVAL '24 hours'
ORDER BY executed_at DESC
LIMIT 20;

-- 現在のレート制限状況
SELECT
  user_id,
  endpoint,
  limit_total,
  remaining,
  ROUND((remaining::NUMERIC / limit_total::NUMERIC) * 100, 2) as remaining_percent,
  reset_at,
  CASE
    WHEN remaining = 0 THEN '🚨 制限到達'
    WHEN (remaining::NUMERIC / limit_total::NUMERIC) < 0.1 THEN '🔴 危険 (10%以下)'
    WHEN (remaining::NUMERIC / limit_total::NUMERIC) < 0.2 THEN '⚠️ 警告 (20%以下)'
    WHEN (remaining::NUMERIC / limit_total::NUMERIC) < 0.5 THEN '🟡 注意 (50%以下)'
    ELSE '✅ 正常'
  END as status,
  EXTRACT(MINUTE FROM (reset_at - NOW())) as minutes_until_reset
FROM rate_limits
WHERE window_started_at > NOW() - INTERVAL '1 hour'
  AND endpoint IN (
    '/2/users/:id/following',
    '/2/tweets',
    '/2/users/:id/likes',
    '/2/tweets/search/recent'
  )
ORDER BY remaining_percent ASC;

-- ==========================================
-- 4. 総合ステータスサマリー
-- ==========================================

WITH token_status AS (
  SELECT
    COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
    COUNT(*) FILTER (WHERE is_active = false) as inactive_tokens
  FROM account_tokens
  WHERE token_type = 'oauth2'
),
recent_errors AS (
  SELECT
    COUNT(*) FILTER (WHERE error_message LIKE '%429%') as rate_limit_errors,
    COUNT(*) FILTER (WHERE success = false) as total_errors,
    COUNT(*) as total_executions
  FROM auto_engagement_executions
  WHERE executed_at > NOW() - INTERVAL '1 hour'
),
rate_limit_status AS (
  SELECT
    COUNT(*) FILTER (WHERE remaining = 0) as depleted_endpoints,
    COUNT(*) FILTER (WHERE remaining::NUMERIC / limit_total::NUMERIC < 0.2) as warning_endpoints,
    COUNT(*) as total_endpoints
  FROM rate_limits
  WHERE window_started_at > NOW() - INTERVAL '15 minutes'
)
SELECT
  '🔹 CORS' as category,
  '✅ ALLOWED_ORIGINS 設定済み' as status,
  NULL as detail
UNION ALL
SELECT
  '🔹 トークン',
  CASE
    WHEN ts.active_tokens = 0 THEN '🚨 アクティブなトークンなし'
    WHEN ts.active_tokens < 3 THEN '⚠️ アクティブなトークン少数 (' || ts.active_tokens || '件)'
    ELSE '✅ アクティブなトークン正常 (' || ts.active_tokens || '件)'
  END,
  'Inactive: ' || ts.inactive_tokens || '件'
FROM token_status ts
UNION ALL
SELECT
  '🔹 エンゲージメント (過去1時間)',
  CASE
    WHEN re.total_executions = 0 THEN '⚪ 実行履歴なし'
    WHEN re.rate_limit_errors::NUMERIC / re.total_executions > 0.1 THEN '🚨 429エラー頻発 (' || re.rate_limit_errors || '/' || re.total_executions || ')'
    WHEN re.rate_limit_errors > 0 THEN '⚠️ 429エラーあり (' || re.rate_limit_errors || '/' || re.total_executions || ')'
    ELSE '✅ エラーなし (' || re.total_executions || '件実行)'
  END,
  'Success Rate: ' || ROUND(((re.total_executions - re.total_errors)::NUMERIC / NULLIF(re.total_executions, 0) * 100), 2) || '%'
FROM recent_errors re
UNION ALL
SELECT
  '🔹 レート制限',
  CASE
    WHEN rls.depleted_endpoints > 0 THEN '🚨 制限到達あり (' || rls.depleted_endpoints || '/' || rls.total_endpoints || ')'
    WHEN rls.warning_endpoints > 0 THEN '⚠️ 警告レベル (' || rls.warning_endpoints || '/' || rls.total_endpoints || ')'
    WHEN rls.total_endpoints = 0 THEN '⚪ データなし'
    ELSE '✅ 正常'
  END,
  'Monitored: ' || rls.total_endpoints || ' endpoints'
FROM rate_limit_status rls;
