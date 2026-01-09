# 本番環境デプロイチェックリスト
生成日時: 2026-01-10

## ✅ 事前確認（ローカル環境）

### データベース
- [x] 全マイグレーションが適用済み（3つの新規migration）
- [x] DMテーブル作成確認（dm_send_rules, follower_snapshots, dm_queue）
- [x] twitter_app_idカラム追加確認
- [x] Cronジョブ3つ確認（execute-scheduled-posts, refresh-twitter-tokens, execute-auto-engagement）

### Edge Functions修正確認
- [x] execute-auto-engagement: INSERTスキーマ修正済み
- [x] execute-auto-engagement: user_id絞り込み追加済み
- [x] execute-auto-engagement: 無効ID除外追加済み
- [x] twitter-api-proxy: is_active復活禁止修正済み
- [x] refresh-tokens: is_active復活禁止修正済み

---

## 📋 デプロイ手順

### Step 1: バックアップ作成
```bash
# 本番データベースのバックアップ
npx supabase db dump --db-url "postgresql://postgres:[password]@[host]:5432/postgres" > backup_$(date +%Y%m%d_%H%M%S).sql

# 現在のEdge Functionsバージョンを記録
npx supabase functions list > functions_backup_$(date +%Y%m%d_%H%M%S).txt
```

### Step 2: マイグレーション適用
```bash
# マイグレーションファイルの確認
ls -la supabase/migrations/20260110*.sql

# 本番環境に適用
npx supabase db push

# 適用確認
npx supabase db remote sql "
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('dm_send_rules', 'follower_snapshots', 'dm_queue')
  ORDER BY tablename;
"

# twitter_app_id確認
npx supabase db remote sql "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'account_tokens'
    AND column_name = 'twitter_app_id';
"

# Cronジョブ確認
npx supabase db remote sql "
  SELECT jobname, schedule, active
  FROM cron.job
  ORDER BY jobname;
"
```

### Step 3: app.settings設定（重要）
```bash
# ローカル環境（既に設定済み）
# ALTER DATABASE postgres SET app.settings.supabase_url = 'http://127.0.0.1:54321';
# ALTER DATABASE postgres SET app.settings.service_role_key = 'your-local-key';

# 本番環境（必須設定）
npx supabase db remote sql "
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';
SELECT pg_reload_conf();
"

# 設定確認
npx supabase db remote sql "
SELECT name, setting
FROM pg_settings
WHERE name LIKE 'app.settings.%';
"
```

### Step 4: Edge Functionsデプロイ
```bash
# 修正した関数をデプロイ
npx supabase functions deploy execute-auto-engagement
npx supabase functions deploy twitter-api-proxy
npx supabase functions deploy refresh-tokens

# デプロイ確認
npx supabase functions list
```

### Step 5: 環境変数確認
```bash
# ALLOWED_ORIGINS設定確認
npx supabase secrets list | grep ALLOWED_ORIGINS

# 未設定の場合は設定
# npx supabase secrets set ALLOWED_ORIGINS="https://your-domain.com,https://www.your-domain.com"
```

---

## 🧪 動作確認

### 1. Cronジョブ動作確認
```bash
# Cronジョブのログ確認（数分待つ）
npx supabase db remote sql "
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
"

# 手動でCronジョブ実行（テスト）
curl -X POST "https://your-project-ref.supabase.co/functions/v1/execute-auto-engagement" \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2. 実行履歴確認
```bash
# auto_engagement_executionsテーブル確認
npx supabase db remote sql "
SELECT
  id,
  rule_id,
  status,
  searched_count,
  filtered_count,
  actions_attempted,
  actions_succeeded,
  actions_failed,
  executed_at
FROM auto_engagement_executions
ORDER BY executed_at DESC
LIMIT 5;
"

# エラーがある場合
npx supabase db remote sql "
SELECT * FROM auto_engagement_executions
WHERE status = 'failed'
ORDER BY executed_at DESC
LIMIT 10;
"
```

### 3. DMテーブル確認
```bash
# DMルール確認
npx supabase db remote sql "SELECT COUNT(*) FROM dm_send_rules;"

# フォロワースナップショット確認
npx supabase db remote sql "SELECT COUNT(*) FROM follower_snapshots;"

# DMキュー確認
npx supabase db remote sql "
SELECT status, COUNT(*)
FROM dm_queue
GROUP BY status;
"
```

### 4. トークン状態確認
```bash
# アクティブトークン数
npx supabase db remote sql "
SELECT
  account_type,
  COUNT(*) as total,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN twitter_app_id IS NOT NULL THEN 1 ELSE 0 END) as with_app_id
FROM account_tokens
WHERE token_type = 'oauth2'
GROUP BY account_type;
"

# 期限切れ間近のトークン
npx supabase db remote sql "
SELECT
  x_username,
  expires_at,
  is_active,
  twitter_app_id IS NOT NULL as has_app_id
FROM account_tokens
WHERE token_type = 'oauth2'
  AND expires_at < NOW() + INTERVAL '7 days'
ORDER BY expires_at
LIMIT 10;
"
```

### 5. レート制限確認
```bash
npx supabase db remote sql "
SELECT
  endpoint,
  remaining,
  limit_total,
  reset_at,
  ROUND((remaining::numeric / limit_total * 100), 2) as remaining_percent
FROM rate_limits
WHERE reset_at > NOW()
ORDER BY remaining_percent ASC
LIMIT 10;
"
```

---

## ⚠️ ロールバック手順（問題発生時）

### データベースロールバック
```bash
# バックアップから復元
npx supabase db reset --db-url "postgresql://postgres:[password]@[host]:5432/postgres" < backup_YYYYMMDD_HHMMSS.sql

# または特定のマイグレーションを削除
npx supabase db remote sql "
DELETE FROM supabase_migrations.schema_migrations
WHERE version IN ('20260110000001', '20260110000002', '20260110000003');
"
```

### Edge Functionsロールバック
```bash
# 以前のバージョンに戻す（Git経由）
git checkout HEAD~1 -- supabase/functions/execute-auto-engagement
git checkout HEAD~1 -- supabase/functions/twitter-api-proxy
git checkout HEAD~1 -- supabase/functions/refresh-tokens

# 再デプロイ
npx supabase functions deploy execute-auto-engagement
npx supabase functions deploy twitter-api-proxy
npx supabase functions deploy refresh-tokens
```

---

## 📊 監視項目

### 日次確認
```bash
# 1. Cronジョブの実行状況
npx supabase db remote sql "
SELECT
  jobname,
  COUNT(*) as runs_today,
  SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as succeeded,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM cron.job_run_details
WHERE start_time > NOW() - INTERVAL '24 hours'
GROUP BY jobname;
"

# 2. 実行履歴のエラー率
npx supabase db remote sql "
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
"

# 3. DM送信状況
npx supabase db remote sql "
SELECT
  status,
  COUNT(*) as count
FROM dm_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
"

# 4. レート制限警告
npx supabase db remote sql "
SELECT
  endpoint,
  remaining,
  limit_total,
  reset_at
FROM rate_limits
WHERE remaining < limit_total * 0.2
  AND reset_at > NOW()
ORDER BY remaining_percent ASC;
"
```

### 週次確認
```bash
# トークンリフレッシュ状況
npx supabase db remote sql "
SELECT
  DATE(last_refreshed_at) as date,
  COUNT(*) as tokens_refreshed
FROM account_tokens
WHERE last_refreshed_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(last_refreshed_at)
ORDER BY date DESC;
"

# アクティブルール数
npx supabase db remote sql "
SELECT
  'auto_engagement_rules' as type,
  COUNT(*) as active_count
FROM auto_engagement_rules
WHERE is_active = true
UNION ALL
SELECT
  'dm_send_rules' as type,
  COUNT(*) as active_count
FROM dm_send_rules
WHERE status = 'active';
"
```

---

## ✅ デプロイ完了確認チェックリスト

### データベース
- [ ] dm_send_rulesテーブル存在確認
- [ ] follower_snapshotsテーブル存在確認
- [ ] dm_queueテーブル存在確認
- [ ] twitter_app_idカラム存在確認
- [ ] Cronジョブ3つ存在確認
- [ ] app.settings設定確認

### Edge Functions
- [ ] execute-auto-engagementデプロイ確認
- [ ] twitter-api-proxyデプロイ確認
- [ ] refresh-tokensデプロイ確認
- [ ] ALLOWED_ORIGINS設定確認

### 動作確認
- [ ] Cronジョブ実行確認（5分待機）
- [ ] auto_engagement_executionsに新規レコード確認
- [ ] エラーがないことを確認
- [ ] レート制限が正常に記録されていることを確認

### 監視設定
- [ ] 日次監視クエリを実行可能にする
- [ ] 週次監視クエリを実行可能にする
- [ ] アラート設定（オプション）

---

## 🔍 トラブルシューティング

### Cronジョブが実行されない
```bash
# app.settings確認
npx supabase db remote sql "SELECT * FROM pg_settings WHERE name LIKE 'app.settings.%';"

# Cronジョブログ確認
npx supabase db remote sql "SELECT * FROM cron.job_run_details WHERE jobname = 'execute-auto-engagement' ORDER BY start_time DESC LIMIT 5;"
```

### 実行履歴が記録されない
```bash
# INSERTエラー確認
npx supabase logs --type function --function execute-auto-engagement

# スキーマ確認
npx supabase db remote sql "\d auto_engagement_executions"
```

### トークンリフレッシュが動作しない
```bash
# twitter_app_id確認
npx supabase db remote sql "
SELECT
  x_username,
  twitter_app_id IS NOT NULL as has_app_id,
  refresh_token IS NOT NULL as has_refresh_token
FROM account_tokens
WHERE token_type = 'oauth2' AND is_active = true
LIMIT 10;
"
```

---

## 📝 デプロイ記録

### デプロイ実行者
- 実行者: _____________
- 実行日時: 2026-01-10 __:__

### 結果
- [ ] 成功
- [ ] 部分的成功（問題: _______________）
- [ ] 失敗（理由: _______________）

### 備考
```
_______________________________________________
_______________________________________________
_______________________________________________
```
