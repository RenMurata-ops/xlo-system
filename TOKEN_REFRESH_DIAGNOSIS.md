# トークン自動リフレッシュ診断レポート

**日時**: 2026-01-11
**問題**: トークン期限切れが発生している
**調査内容**: 自動リフレッシュ機能の動作状況

---

## 診断結果サマリー

### ✅ 実装済み機能

1. **トークンリフレッシュEdge Function** - `supabase/functions/refresh-tokens/index.ts`
   - ✅ 単一トークンリフレッシュ対応
   - ✅ 一括リフレッシュ対応
   - ✅ エラーハンドリング実装済み
   - ✅ トークン無効化機能あり

2. **Cronジョブ設定** - `20251119000010_add_cron_refresh_tokens.sql`
   - ✅ 30分ごとに実行設定
   - ✅ pg_cron拡張有効化
   - ✅ pg_net拡張有効化（HTTP POST用）

### ⚠️ 確認が必要な項目

1. **Cronジョブの実行状態**
   - ❓ Cronジョブが実際に動作しているか不明
   - ❓ pg_cron拡張が正しくインストールされているか
   - ❓ サービスロールキーの設定が正しいか

2. **Twitter App設定**
   - ❓ OAuth 2.0クライアントID/シークレットが正しく設定されているか
   - ❓ アクティブなTwitter Appが存在するか

3. **トークンの状態**
   - ❓ 実際のトークン有効期限
   - ❓ refresh_tokenが存在するか
   - ❓ is_activeフラグの状態

---

## 実装されている自動リフレッシュの仕組み

### 1. Cronジョブ（30分ごと）

**設定内容**:
```sql
SELECT cron.schedule(
  'refresh-twitter-tokens',
  '*/30 * * * *',  -- 30分ごと
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**動作**:
- 30分ごとに自動実行
- Edge Function `refresh-tokens` を呼び出し
- サービスロールキーで認証

### 2. リフレッシュロジック

**対象トークン**:
```typescript
// 1時間以内に期限切れとなるトークンを検索
const oneHourFromNow = new Date();
oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

const { data: expiringTokens } = await supabase
  .from('account_tokens')
  .select('...')
  .eq('token_type', 'oauth2')
  .eq('is_active', true)  // アクティブなトークンのみ
  .not('refresh_token', 'is', null)  // リフレッシュトークンがある
  .lt('expires_at', oneHourFromNow.toISOString());  // 1時間以内に期限切れ
```

**リフレッシュ処理**:
```typescript
// Twitter OAuth 2.0 APIを呼び出し
const response = await fetch('https://api.twitter.com/2/oauth2/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${btoa(`${client_id}:${client_secret}`)}`,
  },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenRecord.refresh_token,
  }),
});

// 成功時にDBを更新
await supabase
  .from('account_tokens')
  .update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || tokenRecord.refresh_token,
    expires_at: expiresAt.toISOString(),
    last_refreshed_at: new Date().toISOString(),
    refresh_count: (tokenRecord.refresh_count || 0) + 1,
    error_message: null,
  })
  .eq('id', tokenRecord.id);
```

### 3. エラーハンドリング

**自動無効化**:
```typescript
// 400 or 401エラーの場合、トークンを無効化
if (response.status === 400 || response.status === 401) {
  await supabase
    .from('account_tokens')
    .update({
      is_active: false,
      error_message: `Refresh failed: ${errorText}`,
    })
    .eq('id', tokenRecord.id);
}
```

**セキュリティ考慮**:
- 手動で無効化されたトークン（`is_active=false`）は自動では再有効化しない
- リフレッシュ成功時も`is_active`は変更しない（既存の状態を保持）

---

## トークン期限切れが発生する可能性のある原因

### 1. **Cronジョブが動作していない** ⚠️（最も可能性が高い）

**考えられる理由**:
- pg_cron拡張がSupabase側で有効化されていない
- Cronジョブのスケジュールが正しく登録されていない
- `app.settings.service_role_key` 設定が存在しない

**確認方法**:
```sql
-- Cronジョブの状態を確認
SELECT * FROM cron.job WHERE jobname = 'refresh-twitter-tokens';

-- Cronジョブの実行履歴を確認
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'refresh-twitter-tokens')
ORDER BY start_time DESC
LIMIT 10;
```

### 2. **Twitter Appの設定不備** ⚠️

**考えられる理由**:
- OAuth 2.0のclient_id/client_secretが設定されていない
- Twitter Appが`is_active=false`になっている
- `twitter_app_id`がaccount_tokensに正しく設定されていない

**確認方法**:
```sql
-- Twitter Appの状態を確認
SELECT id, app_name, api_key, is_active, created_at
FROM twitter_apps
WHERE is_active = true;

-- account_tokensとTwitter Appの紐付けを確認
SELECT
  at.id,
  at.x_username,
  at.twitter_app_id,
  ta.app_name,
  ta.is_active as app_is_active
FROM account_tokens at
LEFT JOIN twitter_apps ta ON at.twitter_app_id = ta.id
WHERE at.is_active = true;
```

### 3. **refresh_tokenが存在しない** ⚠️

**考えられる理由**:
- OAuth 1.0aトークン（refresh_tokenなし）
- 初回OAuth時にrefresh_tokenを取得できなかった

**確認方法**:
```sql
-- refresh_tokenの有無を確認
SELECT
  id,
  x_username,
  token_type,
  CASE WHEN refresh_token IS NULL THEN 'NO_REFRESH_TOKEN' ELSE 'HAS_REFRESH_TOKEN' END as refresh_status,
  expires_at
FROM account_tokens
WHERE is_active = true
ORDER BY expires_at ASC;
```

### 4. **サービスロールキーの設定ミス** ⚠️

**考えられる理由**:
- `app.settings.service_role_key`がデータベースに設定されていない
- Cronジョブが認証エラーで実行できない

**確認方法**:
```sql
-- サービスロールキー設定の確認
SHOW app.settings.service_role_key;

-- または
SELECT current_setting('app.settings.service_role_key', true);
```

---

## 即座に実行すべき診断手順

### ステップ1: Cronジョブの状態確認

```sql
-- 本番DBに接続して実行
SELECT * FROM cron.job WHERE jobname = 'refresh-twitter-tokens';
```

**期待される結果**: 1行のジョブ情報が返される

**もし何も返されない場合**: Cronジョブが登録されていない
→ マイグレーションを再実行する必要あり

### ステップ2: Cronジョブの実行履歴確認

```sql
SELECT
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'refresh-twitter-tokens')
ORDER BY start_time DESC
LIMIT 10;
```

**期待される結果**: 30分ごとの実行履歴

**確認ポイント**:
- `status` = 'succeeded' であるか
- `return_message` にエラーが含まれていないか

### ステップ3: 実際のトークン状態確認

```sql
SELECT
  id,
  x_username,
  account_type,
  token_type,
  expires_at,
  CASE
    WHEN expires_at IS NULL THEN 'NO_EXPIRY'
    WHEN expires_at < NOW() THEN 'EXPIRED ❌'
    WHEN expires_at < NOW() + INTERVAL '1 hour' THEN 'EXPIRING_SOON ⚠️'
    WHEN expires_at < NOW() + INTERVAL '1 day' THEN 'VALID (< 1 day)'
    ELSE 'VALID ✅'
  END as token_status,
  last_refreshed_at,
  refresh_count,
  CASE WHEN refresh_token IS NULL THEN 'NO' ELSE 'YES' END as has_refresh_token,
  is_active,
  twitter_app_id
FROM account_tokens
WHERE is_active = true
ORDER BY expires_at ASC NULLS LAST
LIMIT 20;
```

### ステップ4: Twitter App設定確認

```sql
SELECT
  ta.id,
  ta.app_name,
  ta.is_active,
  ta.created_at,
  COUNT(at.id) as token_count,
  COUNT(CASE WHEN at.is_active THEN 1 END) as active_token_count
FROM twitter_apps ta
LEFT JOIN account_tokens at ON ta.id = at.twitter_app_id
GROUP BY ta.id, ta.app_name, ta.is_active, ta.created_at
ORDER BY ta.is_active DESC, ta.created_at DESC;
```

### ステップ5: サービスロールキー確認

```sql
SELECT current_setting('app.settings.service_role_key', true) as service_role_key;
```

**もしNULLが返される場合**: 設定が存在しない
→ 設定を追加する必要あり

---

## 応急処置: 手動トークンリフレッシュ

Cronジョブが動作していない場合、手動でトークンをリフレッシュできます:

### 方法1: Edge Functionを直接呼び出し

```bash
curl -X POST 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### 方法2: 特定のトークンのみリフレッシュ

```bash
curl -X POST 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token_id": "TOKEN_UUID_HERE"}'
```

### 方法3: UIから手動リフレッシュ

アカウント管理画面に「トークンを更新」ボタンがあれば、それをクリック。

---

## 恒久的な修正方法

### 修正1: Cronジョブが動いていない場合

**原因**: pg_cron拡張が無効、またはジョブが登録されていない

**修正手順**:

1. pg_cron拡張を有効化:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

2. サービスロールキーを設定:
```sql
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

3. Cronジョブを再登録:
```sql
-- 既存のジョブを削除（もしあれば）
SELECT cron.unschedule('refresh-twitter-tokens');

-- 新しいジョブを登録
SELECT cron.schedule(
  'refresh-twitter-tokens',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

### 修正2: Twitter App設定の修正

**原因**: client_id/client_secretが設定されていない

**修正手順**:

Twitter Developer Portalから正しいOAuth 2.0認証情報を取得し、DBに設定:

```sql
UPDATE twitter_apps
SET
  api_key = 'YOUR_CLIENT_ID',
  api_secret = 'YOUR_CLIENT_SECRET'
WHERE id = 'YOUR_APP_ID';
```

### 修正3: account_tokensにtwitter_app_idを設定

**原因**: トークンがTwitter Appに紐付いていない

**修正手順**:

```sql
-- デフォルトのTwitter Appを全トークンに設定
UPDATE account_tokens
SET twitter_app_id = (
  SELECT id FROM twitter_apps
  WHERE user_id = account_tokens.user_id
  AND is_active = true
  LIMIT 1
)
WHERE twitter_app_id IS NULL
AND is_active = true;
```

---

## モニタリング・アラート設定（推奨）

### 1. トークン期限切れアラート

**実装方法**: Supabase Webhooksを使用

```sql
-- トークン期限切れを検知するビュー
CREATE OR REPLACE VIEW v_expiring_tokens AS
SELECT
  id,
  x_username,
  account_type,
  expires_at,
  last_refreshed_at
FROM account_tokens
WHERE is_active = true
AND token_type = 'oauth2'
AND expires_at < NOW() + INTERVAL '2 hours'
ORDER BY expires_at ASC;
```

### 2. Cronジョブ失敗アラート

**実装方法**: cron.job_run_detailsを定期的にチェック

```sql
-- 直近の失敗を確認
SELECT * FROM cron.job_run_details
WHERE status != 'succeeded'
AND start_time > NOW() - INTERVAL '24 hours'
ORDER BY start_time DESC;
```

---

## 推奨アクション（優先順位順）

### 🔥 最優先（今すぐ実行）

1. ✅ **Cronジョブの状態確認**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'refresh-twitter-tokens';
   ```

2. ✅ **トークンの期限確認**
   ```sql
   SELECT x_username, expires_at FROM account_tokens
   WHERE is_active = true AND expires_at < NOW() + INTERVAL '1 day';
   ```

3. ⚠️ **手動リフレッシュ実行**（期限切れが迫っている場合）
   ```bash
   curl -X POST 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens' \
     -H "Authorization: Bearer SERVICE_ROLE_KEY"
   ```

### 🔧 高優先度（24時間以内）

4. サービスロールキーの設定確認
5. Twitter App設定の確認・修正
6. Cronジョブの再登録（必要に応じて）

### 📊 中優先度（1週間以内）

7. モニタリング・アラート設定
8. 実行履歴の確認ダッシュボード作成
9. 自動リフレッシュのテスト実施

---

## まとめ

### 実装状況
- ✅ トークンリフレッシュロジック: 完全実装済み
- ✅ Cronジョブ設定: マイグレーションに存在
- ⚠️ 実際の動作状況: 未確認

### 次のステップ
1. 本番DBに接続してCronジョブの状態を確認
2. トークンの実際の有効期限を確認
3. 必要に応じて手動リフレッシュを実行
4. Cronジョブが動いていない場合は修正を適用

### 連絡先情報
- トークン期限: `account_tokens.expires_at`
- 最終リフレッシュ: `account_tokens.last_refreshed_at`
- リフレッシュ回数: `account_tokens.refresh_count`

---

*作成日時: 2026-01-11*
*対象システム: XLO System*
*データベース: Supabase (swyiwqzlmozlqircyyzr)*
