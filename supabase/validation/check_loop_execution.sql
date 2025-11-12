-- ============================================================================
-- Loop Execution Validation Queries
-- ============================================================================

-- 1. ループ実行可能なレコード
SELECT
  id,
  loop_name,
  is_active,
  next_execution_at,
  execution_interval_hours,
  post_count
FROM loops
WHERE is_active = true
ORDER BY next_execution_at ASC NULLS FIRST
LIMIT 10;

-- 2. 最近のループ実行ログ
SELECT
  executed_at,
  loop_id,
  created_posts_count,
  sent_replies_count,
  status,
  error_message
FROM loop_executions
ORDER BY executed_at DESC
LIMIT 20;

-- 3. レート制限最新値
SELECT
  endpoint,
  token_type,
  remaining,
  limit_total,
  reset_at,
  updated_at
FROM rate_limits
ORDER BY updated_at DESC
LIMIT 10;

-- 4. 直近の投稿（重複防止確認用）
SELECT
  created_at,
  content,
  tweet_id,
  status,
  account_id
FROM posts
ORDER BY created_at DESC
LIMIT 10;

-- 5. アクティブなループの統計
SELECT
  COUNT(*) as total_loops,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_loops,
  SUM(post_count) as total_posts,
  AVG(execution_interval_hours) as avg_interval_hours
FROM loops;

-- 6. ループ実行成功率
SELECT
  l.loop_name,
  COUNT(le.id) as total_executions,
  SUM(CASE WHEN le.status = 'success' THEN 1 ELSE 0 END) as successful_executions,
  SUM(le.created_posts_count) as total_posts_created,
  MAX(le.executed_at) as last_executed_at
FROM loops l
LEFT JOIN loop_executions le ON l.id = le.loop_id
GROUP BY l.id, l.loop_name
ORDER BY total_executions DESC
LIMIT 10;

-- 7. 今日のループ実行履歴
SELECT
  DATE_TRUNC('hour', executed_at) as hour,
  COUNT(*) as executions,
  SUM(created_posts_count) as posts_created,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
FROM loop_executions
WHERE executed_at >= CURRENT_DATE
GROUP BY DATE_TRUNC('hour', executed_at)
ORDER BY hour DESC;

-- 8. エラーが多いループ（要確認）
SELECT
  l.loop_name,
  COUNT(le.id) as error_count,
  MAX(le.executed_at) as last_error_at,
  le.error_message
FROM loops l
JOIN loop_executions le ON l.id = le.loop_id
WHERE le.status = 'failed'
  AND le.executed_at >= NOW() - INTERVAL '7 days'
GROUP BY l.id, l.loop_name, le.error_message
ORDER BY error_count DESC
LIMIT 5;

-- 9. 次回実行予定のループ
SELECT
  loop_name,
  next_execution_at,
  last_execution_at,
  execution_interval_hours,
  (next_execution_at - NOW()) as time_until_next
FROM loops
WHERE is_active = true
  AND next_execution_at IS NOT NULL
ORDER BY next_execution_at ASC
LIMIT 10;

-- 10. アカウント別投稿数（ループ経由）
SELECT
  ma.handle as account_handle,
  COUNT(DISTINCT le.loop_id) as loops_used,
  SUM(le.created_posts_count) as total_posts
FROM loop_executions le
JOIN main_accounts ma ON le.executor_account_id = ma.id
WHERE le.executed_at >= NOW() - INTERVAL '30 days'
GROUP BY ma.id, ma.handle
ORDER BY total_posts DESC
LIMIT 10;
