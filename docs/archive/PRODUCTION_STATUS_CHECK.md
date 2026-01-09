# 本番環境ステータス確認

**実行日時**: 2026-01-09
**確認項目**: CORS / トークン / エンゲージメントエラー

---

## 1. ✅ CORS: ALLOWED_ORIGINS 設定確認

### 確認方法
```bash
SUPABASE_ACCESS_TOKEN="YOUR_TOKEN" \
supabase secrets list --project-ref swyiwqzlmozlqircyyzr | grep ALLOWED_ORIGINS
```

### 確認結果
```
✅ ALLOWED_ORIGINS が設定されています
値: eb21d9473194e64c9219d7c9c3de439a53f6cd431dddc3ef0bde4e7932720c4c (暗号化済み)
```

**ステータス**: ✅ **正常** - ALLOWED_ORIGINS は本番環境で設定済み

**注意事項**:
- Edge Functions は fail-safe モードで動作中
- 未設定の Origin からのアクセスは自動的にブロックされます
- Origin 追加が必要な場合は OPERATIONS_GUIDE.md を参照

---

## 2. ⚠️ トークン: is_active=true の確認

### 確認方法

#### A. Supabase SQL Editor で確認（推奨）
1. https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/editor にアクセス
2. 以下のクエリを実行:

```sql
-- アクティブなトークン数を確認
SELECT
  account_type,
  COUNT(*) as active_count,
  STRING_AGG(x_username, ', ') as usernames
FROM account_tokens
WHERE is_active = true
  AND token_type = 'oauth2'
GROUP BY account_type;
```

**期待される結果**:
```
account_type | active_count | usernames
-------------+--------------+------------
main         | 3            | user1, user2, user3
spam         | 5            | spam1, spam2, ...
```

**アラート基準**:
- 🚨 **緊急**: active_count = 0 (すべてのトークンが無効)
- ⚠️ **警告**: active_count < 3 (トークンが少数)
- ✅ **正常**: active_count >= 3

#### B. 詳細確認（有効期限含む）

```sql
SELECT
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
  error_message
FROM account_tokens
WHERE token_type = 'oauth2'
ORDER BY is_active DESC, expires_at ASC;
```

### 対応アクション

#### アクティブなトークンが0件の場合
```sql
-- 無効化されたトークンの原因を確認
SELECT
  x_username,
  account_type,
  error_message,
  updated_at
FROM account_tokens
WHERE is_active = false
  AND token_type = 'oauth2'
ORDER BY updated_at DESC;
```

**対応手順** (OPERATIONS_GUIDE.md 参照):
1. エラー原因を確認
2. 必要に応じて再認証
3. または手動でトークンを有効化

```sql
-- エラーが解消済みの場合のみ実行
UPDATE account_tokens
SET
  is_active = true,
  error_message = null,
  updated_at = NOW()
WHERE id = 'トークンのID';
```

---

## 3. ⚠️ エンゲージメント: 429 エラーの確認

### 確認方法

#### A. 過去24時間の 429 エラー頻度

```sql
-- 時間別のエラー率を確認
SELECT
  DATE_TRUNC('hour', executed_at) as hour,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE error_message LIKE '%429%' OR error_message LIKE '%rate limit%') as rate_limit_errors,
  ROUND(
    (COUNT(*) FILTER (WHERE error_message LIKE '%429%')::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) as error_rate_percent
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', executed_at)
ORDER BY hour DESC;
```

**アラート基準**:
- 🚨 **緊急**: error_rate_percent > 10% (頻発)
- ⚠️ **警告**: error_rate_percent 5-10%
- 🟡 **注意**: error_rate_percent 1-5%
- ✅ **正常**: error_rate_percent < 1%

#### B. 現在のレート制限状況

```sql
-- 主要エンドポイントの残量を確認
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
```

**主要エンドポイントの制限**:
| エンドポイント | 制限 (15分) | 用途 |
|-------------|------------|------|
| `/2/users/:id/following` | 50 | フォロー実行 |
| `/2/tweets` | 200 | ツイート投稿 |
| `/2/users/:id/likes` | 50 | いいね実行 |
| `/2/tweets/search/recent` | 180 | ツイート検索 |

#### C. 429 エラーの詳細ログ

```sql
-- 最近の 429 エラーの詳細
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
```

### 対応アクション

#### 🚨 429 エラーが頻発している場合（10%以上）

**即座の対応**:
```sql
-- 影響を受けているルールを一時停止
UPDATE engagement_rules
SET is_active = false
WHERE id IN (
  SELECT DISTINCT rule_id
  FROM auto_engagement_executions
  WHERE error_message LIKE '%429%'
    AND executed_at > NOW() - INTERVAL '1 hour'
  GROUP BY rule_id
  HAVING COUNT(*) > 5
);
```

**根本対応**:
1. MAX_RULES_PER_INVOCATION を 5 → 3 に減少
2. エンゲージメントルールの実行頻度を調整
3. レート制限リセット後に再開

#### ⚠️ 429 エラーが散発的に発生（5-10%）

**監視強化**:
1. 1時間ごとにレート制限状況を確認
2. レート制限予測クエリを実行（OPERATIONS_GUIDE.md 参照）
3. 残量が20%を切ったらエンゲージメントを一時停止

#### 🟡 429 エラーが少数（1-5%）

**正常範囲**:
- Twitter API の瞬間的な制限
- 監視を継続するが対応不要

---

## 4. 総合ステータスサマリー

### クイック確認クエリ

```sql
-- すべてのステータスを一度に確認
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
    WHEN re.rate_limit_errors::NUMERIC / NULLIF(re.total_executions, 0) > 0.1 THEN '🚨 429エラー頻発 (' || re.rate_limit_errors || '/' || re.total_executions || ')'
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
```

**期待される結果** (正常時):
```
category                      | status                              | detail
------------------------------+-------------------------------------+------------------
🔹 CORS                       | ✅ ALLOWED_ORIGINS 設定済み           | NULL
🔹 トークン                    | ✅ アクティブなトークン正常 (8件)       | Inactive: 2件
🔹 エンゲージメント (過去1時間)   | ✅ エラーなし (45件実行)              | Success Rate: 100.00%
🔹 レート制限                  | ✅ 正常                              | Monitored: 12 endpoints
```

---

## 実行手順

1. **Supabase SQL Editor を開く**
   ```
   https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/editor
   ```

2. **総合ステータスクエリを実行**
   - 上記の「総合ステータスサマリー」クエリをコピペして実行
   - 結果を確認

3. **問題がある場合は詳細確認**
   - トークンに問題がある場合 → セクション2のクエリを実行
   - エンゲージメントに問題がある場合 → セクション3のクエリを実行

4. **対応アクションの実行**
   - 各セクションの「対応アクション」を参照
   - OPERATIONS_GUIDE.md の該当セクションも確認

---

## 確認頻度の推奨

- **総合ステータス**: 1時間ごと
- **レート制限**: 1時間ごと（429エラー発生時は15分ごと）
- **トークン**: 1日1回
- **CORS**: 設定変更時のみ

---

**作成日**: 2026-01-09
**関連ドキュメント**: OPERATIONS_GUIDE.md, check_production_status.sql
