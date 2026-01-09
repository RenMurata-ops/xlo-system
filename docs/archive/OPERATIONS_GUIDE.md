# XLO System 運用ガイド

## ⚠️ セキュリティ注意事項

**このドキュメントに含まれるコマンドについて**:
- すべての `SUPABASE_ACCESS_TOKEN` は **プレースホルダー** です
- 実際の値は Supabase Dashboard → Settings → API から取得してください
- **絶対に実際のトークンをコミットしないでください**
- トークンが漏洩した場合は即座にローテーションしてください

---

## トークン管理の仕様変更（重要）

### 変更内容

**セキュリティ修正により、トークン管理の動作が変更されました。**

#### 修正前の動作（廃止）
- `is_active=false` のトークンでも `refresh_token` があれば自動的に使用
- エラーで無効化されたトークンが自動復帰
- **問題**: ユーザーが意図的に無効化したトークンも勝手に復活

#### 修正後の動作（現在）
- `is_active=true` のトークンのみ使用
- `is_active=false` のトークンは完全に無視
- **メリット**: ユーザーの意図した無効化が維持される
- **注意**: エラーで無効化されたトークンは手動復帰が必要

---

## トークンが無効化される原因

### 自動無効化（is_active=false になる）

1. **Twitter API エラー**
   - トークンが失効（revoked）
   - アカウントが凍結
   - 認証エラー

2. **リフレッシュ失敗**
   - refresh_token が無効
   - Twitter App の設定ミス

### 手動無効化

1. **ユーザーによる無効化**
   - UI でアカウントを無効化
   - 意図的な運用停止

---

## トークン復帰の手順

### 1. 無効化されたトークンの確認

```sql
-- Supabase SQL Editor で実行
SELECT
  id,
  x_username,
  account_type,
  is_active,
  error_message,
  last_refreshed_at,
  expires_at
FROM account_tokens
WHERE is_active = false
  AND token_type = 'oauth2'
ORDER BY updated_at DESC;
```

### 2. エラー原因の確認

**error_message を確認**:
- `Token expired` → リフレッシュ実行で復帰可能
- `Invalid refresh token` → 再認証が必要
- `Account suspended` → Twitter で凍結解除後に再認証

### 3. 復帰方法

#### A. 単純な有効化（エラーが解消済みの場合）

```sql
-- トークンを手動で有効化
UPDATE account_tokens
SET
  is_active = true,
  error_message = null,
  updated_at = NOW()
WHERE id = 'トークンのID';
```

#### B. 再認証（推奨）

1. UI でアカウント一覧を開く
2. 該当アカウントの「再認証」ボタンをクリック
3. Twitter OAuth フローを完了
4. 新しいトークンが自動的に作成される

---

## 監視とアラート

### 定期確認クエリ

#### 1. 無効化されたトークンの監視

```sql
-- 無効化されたトークン数の確認（毎日実行推奨）
SELECT
  account_type,
  COUNT(*) as inactive_count,
  STRING_AGG(DISTINCT error_message, ', ') as error_types
FROM account_tokens
WHERE is_active = false
  AND token_type = 'oauth2'
GROUP BY account_type;
```

**アラート基準**:
- ✅ **正常**: inactive_count が 0-2件
- ⚠️ **注意**: inactive_count が 3-5件
- 🚨 **緊急**: inactive_count が 6件以上

#### 2. エンゲージメント実行のレート制限監視（重要）

**背景**: MAX_RULES_PER_INVOCATION を 1 → 5 に増加したため、レート制限到達が 5 倍速くなります。

```sql
-- Twitter API レート制限の使用状況（1時間ごとに実行推奨）
SELECT
  user_id,
  endpoint,
  limit_total,
  remaining,
  ROUND((remaining::NUMERIC / limit_total::NUMERIC) * 100, 2) as remaining_percent,
  used_requests,
  reset_at,
  CASE
    WHEN remaining = 0 THEN '🚨 制限到達'
    WHEN (remaining::NUMERIC / limit_total::NUMERIC) < 0.1 THEN '🔴 危険 (10%以下)'
    WHEN (remaining::NUMERIC / limit_total::NUMERIC) < 0.2 THEN '⚠️ 警告 (20%以下)'
    WHEN (remaining::NUMERIC / limit_total::NUMERIC) < 0.5 THEN '🟡 注意 (50%以下)'
    ELSE '✅ 正常'
  END as status
FROM rate_limits
WHERE window_started_at > NOW() - INTERVAL '1 hour'
  AND endpoint IN (
    '/2/users/:id/following',
    '/2/tweets',
    '/2/users/:id/likes'
  )
ORDER BY remaining_percent ASC, reset_at ASC;
```

**主要エンドポイントのレート制限**:
| エンドポイント | 制限 (15分) | 用途 |
|-------------|------------|------|
| `/2/users/:id/following` | 50 | フォロー実行 |
| `/2/tweets` | 200 | ツイート投稿 |
| `/2/users/:id/likes` | 50 | いいね実行 |
| `/2/tweets/search/recent` | 180 | ツイート検索 |

**アラート基準**:
- 🚨 **緊急**: remaining_percent < 10% または remaining = 0
- ⚠️ **警告**: remaining_percent < 20%
- 🟡 **注意**: remaining_percent < 50%
- ✅ **正常**: remaining_percent >= 50%

#### 3. エンゲージメントルール実行の成功率

```sql
-- 過去24時間のエンゲージメント実行成功率
SELECT
  DATE_TRUNC('hour', executed_at) as hour,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  ROUND(
    (COUNT(*) FILTER (WHERE success = true)::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) as success_rate_percent,
  STRING_AGG(DISTINCT error_message, '; ') FILTER (WHERE success = false) as error_types
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', executed_at)
ORDER BY hour DESC;
```

**アラート基準**:
- ✅ **正常**: success_rate >= 95%
- ⚠️ **警告**: success_rate 90-95%
- 🚨 **緊急**: success_rate < 90%

#### 4. レート制限到達の予測

```sql
-- 現在のレート制限使用速度から到達時刻を予測
WITH current_usage AS (
  SELECT
    user_id,
    endpoint,
    limit_total,
    remaining,
    used_requests,
    reset_at,
    window_started_at,
    EXTRACT(EPOCH FROM (NOW() - window_started_at)) / 60 as elapsed_minutes
  FROM rate_limits
  WHERE window_started_at > NOW() - INTERVAL '15 minutes'
    AND remaining > 0
),
usage_rate AS (
  SELECT
    user_id,
    endpoint,
    limit_total,
    remaining,
    reset_at,
    elapsed_minutes,
    CASE
      WHEN elapsed_minutes > 0 THEN used_requests / elapsed_minutes
      ELSE 0
    END as requests_per_minute
  FROM current_usage
)
SELECT
  user_id,
  endpoint,
  limit_total,
  remaining,
  ROUND(requests_per_minute, 2) as req_per_min,
  CASE
    WHEN requests_per_minute > 0 THEN
      NOW() + (remaining / requests_per_minute * INTERVAL '1 minute')
    ELSE
      NULL
  END as predicted_depletion_time,
  reset_at as limit_reset_time,
  CASE
    WHEN requests_per_minute > 0 AND (remaining / requests_per_minute) < 5 THEN '🚨 5分以内に枯渇'
    WHEN requests_per_minute > 0 AND (remaining / requests_per_minute) < 15 THEN '⚠️ 15分以内に枯渇'
    WHEN requests_per_minute > 0 AND (remaining / requests_per_minute) < 60 THEN '🟡 1時間以内に枯渇'
    ELSE '✅ 余裕あり'
  END as alert_status
FROM usage_rate
WHERE requests_per_minute > 0
ORDER BY predicted_depletion_time ASC NULLS LAST;
```

**対応アクション**:
- 🚨 **5分以内に枯渇**: 該当ユーザーのエンゲージメントルールを一時停止
- ⚠️ **15分以内に枯渇**: エンゲージメント頻度を調整
- 🟡 **1時間以内に枯渇**: 監視を強化

#### 5. 過去のレート制限到達履歴

```sql
-- 過去7日間でレート制限に到達した回数
SELECT
  user_id,
  endpoint,
  DATE(window_started_at) as date,
  COUNT(*) as times_hit_limit,
  MIN(reset_at) as first_hit,
  MAX(reset_at) as last_hit
FROM rate_limits
WHERE remaining = 0
  AND window_started_at > NOW() - INTERVAL '7 days'
GROUP BY user_id, endpoint, DATE(window_started_at)
ORDER BY date DESC, times_hit_limit DESC;
```

**アラート基準**:
- 🚨 **緊急**: 1日に3回以上制限到達
- ⚠️ **警告**: 1日に1-2回制限到達
- ✅ **正常**: 制限到達なし

---

## よくある質問

### Q: トークンが勝手に無効化される

**A**: 以下を確認してください：
1. Twitter App の設定が正しいか
2. callback URL が正しいか
3. refresh_token が有効か
4. Twitter アカウントが凍結されていないか

### Q: 無効化されたトークンを一括で復帰したい

**A**: 原因が解消されている場合のみ実行：

```sql
-- 注意: 実行前に必ず原因を確認してください
UPDATE account_tokens
SET
  is_active = true,
  error_message = null,
  updated_at = NOW()
WHERE is_active = false
  AND token_type = 'oauth2'
  AND error_message LIKE '%Token expired%';
```

### Q: 自動復帰機能は完全に廃止されたのか？

**A**: はい。セキュリティ上の理由で廃止されました。
- **理由**: ユーザーが意図的に無効化したトークンが勝手に復活する問題を防ぐため
- **対応**: 定期的な監視と必要に応じた手動復帰で運用してください

---

## トラブルシューティング

### トークンリフレッシュが動作しない

```bash
# リフレッシュ関数を手動実行
curl -X POST "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens" \
  -H "Content-Type: application/json"
```

### CORS エラーが発生する

**原因**: `ALLOWED_ORIGINS` が未設定

**解決方法**:
```bash
SUPABASE_ACCESS_TOKEN="sbp_..." supabase secrets set \
  ALLOWED_ORIGINS="https://your-domain.com" \
  --project-ref swyiwqzlmozlqircyyzr
```

---

## 環境変数の必須設定

### 本番環境で必須

```bash
# CORS設定（必須）
ALLOWED_ORIGINS="https://your-production-domain.com,https://www.your-production-domain.com"

# その他（既に設定済みのはず）
SUPABASE_URL="https://swyiwqzlmozlqircyyzr.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="ey..."
SUPABASE_ANON_KEY="ey..."
```

### 設定確認

```bash
# 現在の設定を確認
SUPABASE_ACCESS_TOKEN="sbp_..." supabase secrets list \
  --project-ref swyiwqzlmozlqircyyzr
```

---

## ALLOWED_ORIGINS 運用マニュアル（重要）

### 概要と重要性

**ALLOWED_ORIGINS は本番環境で必須の設定です。**

#### セキュリティ修正内容

- **修正前**: 未設定の場合、localhost:3000 にフォールバック → 本番で CORS エラー
- **修正後**: 未設定の場合、本番環境で **即座にエラー** → セキュリティ fail-safe

**この変更により**:
- ✅ 本番環境での設定漏れを早期検出
- ✅ 不正な Origin からのアクセスを完全にブロック
- ✅ 開発環境では自動的に `*` (ワイルドカード) を使用

---

### 初回セットアップ手順

#### 1. 本番ドメインの確認

```bash
# 本番環境で使用するドメインをリストアップ
# 例:
# - https://app.xlo-system.com
# - https://www.xlo-system.com
# - https://dashboard.xlo-system.com
```

#### 2. ALLOWED_ORIGINS の設定

```bash
# 複数ドメインをカンマ区切りで設定
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase secrets set \
  ALLOWED_ORIGINS="https://app.xlo-system.com,https://www.xlo-system.com,https://dashboard.xlo-system.com" \
  --project-ref swyiwqzlmozlqircyyzr
```

#### 3. 設定の確認

```bash
# 設定が反映されているか確認
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase secrets list --project-ref swyiwqzlmozlqircyyzr | grep ALLOWED_ORIGINS
```

**期待される出力**:
```
ALLOWED_ORIGINS | https://app.xlo-system.com,https://www...
```

#### 4. Edge Functions の再デプロイ

```bash
# IMPORTANT: 設定変更後は Edge Functions を再デプロイ
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase functions deploy twitter-api-proxy refresh-tokens execute-auto-engagement \
  --project-ref swyiwqzlmozlqircyyzr
```

**注意**: 環境変数の変更は既存のデプロイには反映されません。必ず再デプロイが必要です。

---

### テスト手順

#### テスト 1: CORS プリフライト

```bash
# OPTIONS リクエストをテスト
curl -X OPTIONS "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/twitter-api-proxy" \
  -H "Origin: https://app.xlo-system.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**期待される応答**:
```
< HTTP/2 200
< access-control-allow-origin: https://app.xlo-system.com
< access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS
```

#### テスト 2: 不正な Origin からのアクセス

```bash
# 許可されていない Origin からのリクエスト
curl -X OPTIONS "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/twitter-api-proxy" \
  -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**期待される動作**:
- CORS ヘッダーが返らない、または ALLOWED_ORIGINS の最初の値が返る
- ブラウザで実行した場合、CORS エラーが発生

#### テスト 3: 実際の API 呼び出し

```bash
# 本番環境から twitter-api-proxy を呼び出し
curl -X POST "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/twitter-api-proxy" \
  -H "Origin: https://app.xlo-system.com" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "/2/users/me", "method": "GET"}'
```

**期待される応答**:
```json
{
  "success": true,
  "data": {...}
}
```

---

### トラブルシューティング

#### エラー 1: "SECURITY ERROR: ALLOWED_ORIGINS environment variable must be set in production"

**原因**: 本番環境で ALLOWED_ORIGINS が未設定

**解決方法**:
1. 上記の「初回セットアップ手順」を実行
2. Edge Functions を再デプロイ

**確認方法**:
```bash
# Edge Function のログを確認
# Supabase Dashboard → Functions → 該当関数 → Logs
```

#### エラー 2: "CORS エラー" (ブラウザコンソール)

**原因**: フロントエンドの Origin が ALLOWED_ORIGINS に含まれていない

**解決方法**:
```bash
# 現在の ALLOWED_ORIGINS を確認
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase secrets list --project-ref swyiwqzlmozlqircyyzr | grep ALLOWED_ORIGINS

# 不足している Origin を追加（既存の値も含める）
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase secrets set \
  ALLOWED_ORIGINS="https://existing.com,https://new-origin.com" \
  --project-ref swyiwqzlmozlqircyyzr

# Edge Functions を再デプロイ（重要）
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase functions deploy twitter-api-proxy --project-ref swyiwqzlmozlqircyyzr
```

#### エラー 3: 環境変数を更新したが反映されない

**原因**: Edge Functions の再デプロイを忘れている

**解決方法**:
```bash
# すべての Edge Functions を再デプロイ
cd /Users/renmurata/Downloads/xlo-system

SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase functions deploy \
  twitter-api-proxy \
  twitter-oauth-start \
  twitter-oauth-callback-v2 \
  refresh-tokens \
  execute-auto-engagement \
  execute-bulk-posts \
  execute-cta-triggers \
  execute-cta-loop \
  execute-loop \
  execute-scheduled-posts \
  execute-single-post \
  execute-auto-unfollow \
  execute-targeted-engagement \
  dispatch-dms \
  detect-followbacks \
  fetch-post-engagement \
  sync-follower-counts \
  schedule-loop-execution \
  --project-ref swyiwqzlmozlqircyyzr
```

---

### 環境別の動作

#### 本番環境（Supabase Cloud）

```typescript
const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined;
// → true

if (!allowedOrigins && isProduction) {
  throw new Error('SECURITY ERROR: ALLOWED_ORIGINS must be set');
  // → 即座にエラーで停止
}
```

**結果**: ALLOWED_ORIGINS が未設定の場合、すべての Edge Functions が即座にエラー

#### ローカル開発環境

```typescript
const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined;
// → false (DENO_DEPLOYMENT_ID が存在しない)

if (!allowedOrigins && !isProduction) {
  console.warn('WARNING: ALLOWED_ORIGINS not set. Using * for local development only.');
  return { 'Access-Control-Allow-Origin': '*', ... };
  // → ワイルドカードを使用（開発用）
}
```

**結果**: 警告のみで、すべての Origin を許可（開発用）

---

### セキュリティチェックリスト

#### 本番デプロイ前

- [ ] ALLOWED_ORIGINS が設定されている
- [ ] 本番ドメインがすべて含まれている
- [ ] テスト用ドメイン（localhost など）が含まれていない
- [ ] Edge Functions が再デプロイされている
- [ ] CORS テストが成功している

#### 定期確認（月次）

- [ ] 不要な Origin が含まれていないか
- [ ] 新しいドメインが追加された場合、ALLOWED_ORIGINS を更新したか
- [ ] ワイルドカード (`*`) が含まれていないか

---

### 緊急時の対応

#### 本番環境でサービスが停止した場合

**原因**: ALLOWED_ORIGINS 未設定で Edge Functions がエラー

**即座に実行**:
```bash
# 1. 緊急設定（最小構成）
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase secrets set \
  ALLOWED_ORIGINS="https://your-main-domain.com" \
  --project-ref swyiwqzlmozlqircyyzr

# 2. 即座に再デプロイ（並列実行）
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase functions deploy \
  twitter-api-proxy refresh-tokens execute-auto-engagement \
  --project-ref swyiwqzlmozlqircyyzr

# 3. 動作確認
curl -X OPTIONS "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/twitter-api-proxy" \
  -H "Origin: https://your-main-domain.com" -v
```

**目標復旧時間**: 5 分以内

#### 追加ドメインの即座の追加

```bash
# 既存の値を取得
EXISTING=$(SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
  supabase secrets list --project-ref swyiwqzlmozlqircyyzr | grep ALLOWED_ORIGINS | awk '{print $3}')

# 新しいドメインを追加
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase secrets set \
  ALLOWED_ORIGINS="${EXISTING},https://new-domain.com" \
  --project-ref swyiwqzlmozlqircyyzr

# 再デプロイ
SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN" \
supabase functions deploy twitter-api-proxy --project-ref swyiwqzlmozlqircyyzr
```

---

## 定期メンテナンス

### 毎日
- [ ] 無効化されたトークン数の確認（監視クエリ 1）
- [ ] エンゲージメント実行成功率の確認（監視クエリ 3）
- [ ] エラーログの確認

### 1時間ごと（重要）
- [ ] レート制限使用状況の確認（監視クエリ 2）
- [ ] レート制限到達予測の確認（監視クエリ 4）
- [ ] 緊急アラート対応（枯渇まで5分以内の場合）

### 毎週
- [ ] トークンリフレッシュ成功率の確認
- [ ] レート制限到達履歴の確認（監視クエリ 5）
- [ ] ALLOWED_ORIGINS の設定確認

### 毎月
- [ ] 不要なトークンの削除
- [ ] Twitter App の設定確認
- [ ] Edge Functions の最適化レビュー

---

**最終更新**: 2026-01-09
**バージョン**: 3.0
**変更内容**:
- ALLOWED_ORIGINS 運用マニュアル追加
- エンゲージメントレート制限の包括的監視追加
- レート制限到達予測機能追加
