# Stage2 Implementation - Twitter OAuth2 & API Proxy

## 完了内容

### Stage1: スキーマ修正（要件書準拠）

✅ **マイグレーションファイル更新**: `supabase/migrations/20251112_add_missing_tables.sql`

#### 修正されたテーブル

1. **twitter_apps** - UI期待値に合わせて再設計
   - `api_key`, `api_secret`, `bearer_token` 列を追加
   - `permissions`, `callback_url`, `description` 列を追加
   - 旧 `consumer_key`/`consumer_secret` を廃止

2. **post_templates** - 投稿テンプレート（要件準拠）
   - `title`, `content`, `tags`, `usage_count`, `loop_config` 列

3. **post_template_items** - テンプレートアイテム（重み付き）
   - `template_id`, `content`, `weight`, `usage_count` 列

4. **cta_templates** - CTAテンプレート
   - `name`, `content`, `category`, `tags`, `usage_count` 列

5. **loop_executions** - ループ実行ログ（要件準拠名）
   - 旧 `loop_execution_logs` から改名
   - `created_posts_count`, `sent_replies_count`, `used_account_ids`, `exec_data` 列

6. **oauth_sessions** - OAuth PKCE セッション管理
   - `state`, `code_verifier`, `expires_at` 列

7. **rate_limits** - API レート制限記録
   - `endpoint`, `token_type`, `limit_total`, `remaining`, `reset_at` 列

8. **追加列**
   - `spam_accounts.total_engagements` - エンゲージメント総数
   - `proxies.test_status`, `proxies.last_tested_at` - テスト結果記録

### Stage2: Twitter OAuth2 (PKCE) + API Proxy

✅ **Deno設定**
- `supabase/functions/deno.json` - Supabase JS v2.39.0
- `supabase/functions/.env.example` - 環境変数テンプレート

✅ **Edge Functions 実装**

#### 1. `twitter-oauth-start`
**パス**: `supabase/functions/twitter-oauth-start/index.ts`

**機能**:
- OAuth2 PKCE フロー開始
- `state` と `code_verifier` を生成
- `oauth_sessions` テーブルに保存（10分有効期限）
- Twitter 認可URL（code_challenge付き）を返却

**エンドポイント**: `POST /functions/v1/twitter-oauth-start`

**レスポンス**:
```json
{
  "authUrl": "https://twitter.com/i/oauth2/authorize?...",
  "state": "..."
}
```

#### 2. `twitter-oauth-callback-v2`
**パス**: `supabase/functions/twitter-oauth-callback-v2/index.ts`

**機能**:
- Twitter からの OAuth コールバック処理
- `code` と `state` を検証
- `oauth_sessions` から `code_verifier` を取得
- トークン交換（access_token, refresh_token 取得）
- `/2/users/me` でユーザー情報取得
- `account_tokens` に upsert（expires_at 計算）
- 成功時: `/accounts/main?connected=1` へリダイレクト
- 失敗時: `/twitter-apps?error=...` へリダイレクト

**コールバックURL**: `GET /functions/v1/twitter-oauth-callback-v2?code=...&state=...`

#### 3. `twitter-api-proxy`
**パス**: `supabase/functions/twitter-api-proxy/index.ts`

**機能**:
- Twitter API v2 への全リクエストをプロキシ
- `account_tokens` から有効なトークン取得
- トークン有効期限チェック（5分前に自動更新）
- `refresh_token` で自動更新
- レート制限ヘッダ抽出（x-rate-limit-*）
- `rate_limits` テーブルに記録

**エンドポイント**: `POST /functions/v1/twitter-api-proxy`

**リクエスト**:
```json
{
  "endpoint": "/2/tweets",
  "method": "POST",
  "body": { "text": "Hello World" },
  "x_user_id": "optional",
  "account_id": "optional"
}
```

**レスポンス**:
```json
{
  "success": true,
  "status": 200,
  "data": { "data": { "id": "...", "text": "..." } },
  "rateLimits": {
    "limit": "50",
    "remaining": "49",
    "reset": "1699999999"
  }
}
```

✅ **Next.js UI実装**

#### 1. `app/twitter-apps/page.tsx` - OAuth接続ボタン
- 「OAuth2で接続」ボタン追加
- `handleConnectOAuth()` 関数で `twitter-oauth-start` を呼び出し
- 認可URLへリダイレクト

#### 2. `app/accounts/main/page.tsx` - 成功通知
- `?connected=1` クエリパラメータ検知
- 成功メッセージ表示（5秒間）

#### 3. `lib/twitter/api.ts` - APIヘルパー関数
- `callTwitterApi()` - 汎用プロキシ呼び出し
- `postTweet()` - ツイート投稿
- `getUserInfo()` - ユーザー情報取得
- `likeTweet()` - いいね
- `retweet()` - リツイート
- `followUser()` - フォロー

## 次のステップ: デプロイと検証

### 1. データベースマイグレーション実行

Supabase Dashboard → SQL Editor で以下を順番に実行:

```sql
-- 1. 基本スキーマ（既存チェック）
-- supabase/migrations/20251110_initial_schema.sql

-- 2. 追加テーブル（要件準拠）
-- supabase/migrations/20251112_add_missing_tables.sql の内容を実行
```

### 2. Edge Functions デプロイ

```bash
# Supabase CLI でデプロイ
supabase functions deploy twitter-oauth-start
supabase functions deploy twitter-oauth-callback-v2
supabase functions deploy twitter-api-proxy
```

### 3. 環境変数設定

Supabase Dashboard → Edge Functions → Configuration:

```
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
TWITTER_REDIRECT_URI=https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/twitter-oauth-callback-v2
APP_URL=http://localhost:3000  # または本番URL
```

### 4. Next.js 環境変数

`.env.local` に追加（既存設定と統合）:

```
NEXT_PUBLIC_SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 5. Twitter Developer Portal 設定

1. https://developer.twitter.com/en/portal/projects-and-apps にアクセス
2. プロジェクト作成
3. App 作成（OAuth 2.0 有効化）
4. **Callback URI** に設定:
   ```
   https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/twitter-oauth-callback-v2
   ```
5. **Scopes** 選択: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
6. Client ID と Client Secret を取得

## 検証チェックリスト

### ✅ フェーズ1: 接続フロー

1. [ ] `/twitter-apps` → 「OAuth2で接続」クリック
2. [ ] Twitter 認可画面に遷移
3. [ ] 認証後、`/accounts/main?connected=1` にリダイレクト
4. [ ] 成功メッセージ表示
5. [ ] `oauth_sessions` にレコード作成（確認後削除されること）
6. [ ] `account_tokens` に upsert（token_type='oauth2', expires_at, refresh_token 確認）

### ✅ フェーズ2: API プロキシ

1. [ ] `lib/twitter/api.ts` の `postTweet()` でテストツイート
2. [ ] Twitter に実投稿されること
3. [ ] `rate_limits` テーブルに記録されること（remaining が減る）
4. [ ] トークン有効期限が近い場合、自動更新されること

### ✅ フェーズ3: エラーハンドリング

1. [ ] state 不一致時、`/twitter-apps?error=invalid_state` へリダイレクト
2. [ ] トークン交換失敗時、適切なエラーメッセージ
3. [ ] 認証なしでプロキシ呼び出し → 401 エラー

## アーキテクチャ図

```
┌─────────────┐
│  Next.js UI │
│ (Browser)   │
└──────┬──────┘
       │
       │ 1. OAuth2で接続
       ▼
┌──────────────────┐
│ twitter-oauth-   │
│    start         │ ← state, code_verifier 生成
└──────┬───────────┘
       │ oauth_sessions に保存
       │
       │ 2. authUrl 返却
       ▼
┌──────────────────┐
│ Twitter OAuth    │
│  認可画面        │
└──────┬───────────┘
       │
       │ 3. コールバック (code, state)
       ▼
┌──────────────────┐
│ twitter-oauth-   │
│  callback-v2     │ ← トークン交換
└──────┬───────────┘ ← /2/users/me 取得
       │ account_tokens に upsert
       │
       │ 4. /accounts/main?connected=1
       ▼
┌──────────────────┐
│  Next.js UI      │
│ (成功通知)       │
└──────────────────┘

=====================================

API 呼び出しフロー:

┌─────────────┐
│  Next.js UI │
└──────┬──────┘
       │
       │ callTwitterApi({ endpoint, method, body })
       ▼
┌──────────────────┐
│ twitter-api-     │
│    proxy         │ ← account_tokens から取得
└──────┬───────────┘ ← トークン有効期限チェック
       │              ← 必要なら refresh_token で更新
       │
       │ Bearer token 付き
       ▼
┌──────────────────┐
│ Twitter API v2   │
│ (api.twitter.com)│
└──────┬───────────┘
       │ レスポンス + レート制限ヘッダ
       │
       ▼
┌──────────────────┐
│ rate_limits      │ ← x-rate-limit-* 記録
│  テーブル        │
└──────────────────┘
```

## ファイル一覧

### マイグレーション
- `supabase/migrations/20251110_initial_schema.sql` - 基本スキーマ
- `supabase/migrations/20251112_add_missing_tables.sql` - 追加テーブル（要件準拠）

### Edge Functions
- `supabase/functions/deno.json` - Deno設定
- `supabase/functions/.env.example` - 環境変数テンプレート
- `supabase/functions/twitter-oauth-start/index.ts` - OAuth開始
- `supabase/functions/twitter-oauth-callback-v2/index.ts` - OAuthコールバック
- `supabase/functions/twitter-api-proxy/index.ts` - APIプロキシ

### Next.js
- `app/twitter-apps/page.tsx` - OAuth接続ボタン追加
- `app/accounts/main/page.tsx` - 成功通知追加
- `lib/twitter/api.ts` - APIヘルパー関数

## 重要な注意事項

### セキュリティ
- `SUPABASE_SERVICE_ROLE_KEY` は Edge Functions の環境変数でのみ使用
- `access_token`, `refresh_token` は account_tokens に暗号化せず保存（Supabase RLS で保護）
- `oauth_sessions` は10分で期限切れ（cleanup_expired_oauth_sessions() で定期削除可能）

### レート制限
- Twitter API v2 のレート制限は厳しい（例: POST /2/tweets は 17req/15min）
- `rate_limits` テーブルで remaining をモニタリング
- `twitter-api-proxy` で自動的に記録

### トークン更新
- OAuth2 トークンは通常2時間で期限切れ
- `refresh_token` で自動更新（twitter-api-proxy が自動処理）
- 有効期限5分前に自動更新

### テーブル命名
- **post_templates** / **post_template_items** / **cta_templates** に統一（要件準拠）
- **loop_executions** に統一（loop_execution_logs ではない）
- UI から既存の "templates" 汎用テーブルへの参照があれば、上記3テーブルに切り替え必要

## 次回 Stage3 への準備

Stage2 完了後、以下を実装予定:
- 実投稿機能（posts テーブル連携）
- 一括投稿（bulk_post_queue）
- ループ実行（loops テーブル連携）
- エンゲージメント自動化（auto_engagement_rules 連携）

これらは全て `lib/twitter/api.ts` のヘルパー関数を使用して実装可能。
