# Phase 2: Twitter OAuth Token Auto-Refresh System

## 概要

Twitter OAuth 2.0トークンの自動更新システムを実装しました。トークン期限切れによる稼働停止を防ぎ、24時間365日の無人運用を実現します。

## 実装Edge Functions

### 1. auto-token-refresh

**目的**: 期限切れ間近のトークンを自動検知して更新

**実行**: Cron（推奨: 1時間ごと）

**処理フロー**:
1. expires_at < 現在時刻 + 1時間 のトークンを抽出
2. OAuth 2.0 Refresh Token使用
3. 新しいAccess Token取得
4. account_tokensテーブル更新
5. last_refreshed_at更新
6. refresh_count インクリメント

**特徴**:
- 並列処理（5トークン/バッチ）
- エラー時は通知送信
- 失敗したトークンは is_active: false に更新

**レスポンス例**:
```json
{
  "success": true,
  "message": "Refreshed 15 tokens",
  "refreshed": 15,
  "failed": 2,
  "skipped": 0,
  "results": [
    {
      "account_id": "uuid",
      "x_username": "@user1",
      "status": "success"
    }
  ]
}
```

### 2. refresh-expired-tokens

**目的**: 既に期限切れのトークンを一括更新

**実行**: 手動 or 日次Cron

**処理フロー**:
1. expires_at < 現在時刻 のトークン抽出
2. 一括リフレッシュ実行
3. 失敗したアカウントを特定
4. サスペンドフラグ更新
5. 通知送信

**特徴**:
- 並列処理（5トークン/バッチ）
- 失敗時は is_suspended: true に更新
- 緊急度 urgent の通知送信

**使用シーン**:
- システムダウン後の復旧
- 手動メンテナンス
- 定期的なクリーンアップ

### 3. comprehensive-token-refresh

**目的**: 全アカウントの包括的トークン検証と更新

**実行**: 手動 or 週次Cron

**処理フロー**:
1. 全アカウントのトークン取得
2. 接続テスト実行（Twitter API呼び出し）
3. 無効な場合は自動リフレッシュ
4. サスペンドアカウント検知
5. プロフィール情報同期
6. 詳細レポート生成

**特徴**:
- 完全な健全性チェック
- 3トークン/バッチ（レート制限考慮）
- バッチ間に1秒待機
- 統計サマリ生成

**レスポンス統計**:
```json
{
  "stats": {
    "total": 100,
    "valid": 85,
    "expired_refreshed": 10,
    "invalid": 3,
    "suspended": 2,
    "connection_passed": 95
  }
}
```

### 4. validate-and-refresh-tokens

**目的**: 実行前のトークン検証とリフレッシュ

**実行**: 他のEdge Functionsから呼び出し

**リクエスト形式**:
```json
{
  "account_ids": ["uuid1", "uuid2", "uuid3"],
  "auto_refresh": true
}
```

**処理フロー**:
1. 指定されたアカウントのトークン取得
2. 期限チェック
3. 期限切れの場合は自動リフレッシュ
4. 接続テスト実行
5. 有効なアカウントIDリストを返却

**特徴**:
- 高速バリデーション（5トークン/バッチ）
- 有効なアカウントIDのみ返却
- 他の関数から使いやすいAPI

**使用例**:
```typescript
// execute-loop から呼び出し
const response = await fetch('/validate-and-refresh-tokens', {
  method: 'POST',
  body: JSON.stringify({
    account_ids: ['uuid1', 'uuid2', 'uuid3'],
    auto_refresh: true
  })
});

const data = await response.json();
const validIds = data.valid_account_ids; // ['uuid1', 'uuid3']
```

## データベース更新

### account_tokens テーブル

トークン管理に必要なカラム（既存）:
- `access_token` - アクセストークン
- `refresh_token` - リフレッシュトークン（OAuth 2.0）
- `token_type` - oauth1a/oauth2
- `expires_at` - 有効期限（OAuth 2.0）
- `last_refreshed_at` - 最終更新日時
- `refresh_count` - 更新回数
- `is_active` - アクティブフラグ
- `is_suspended` - サスペンドフラグ
- `suspended_at` - サスペンド日時
- `suspended_reason` - サスペンド理由
- `error_message` - エラーメッセージ

## Cronスケジュール設定

Supabase Dashboard → Database → Cron Jobs

### 1. auto-token-refresh（必須）

```sql
SELECT cron.schedule(
  'auto-token-refresh-hourly',
  '0 * * * *',  -- 毎時0分
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/auto-token-refresh',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  ) AS request_id;
  $$
);
```

### 2. refresh-expired-tokens（推奨）

```sql
SELECT cron.schedule(
  'refresh-expired-tokens-daily',
  '0 2 * * *',  -- 毎日2:00
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-expired-tokens',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  ) AS request_id;
  $$
);
```

### 3. comprehensive-token-refresh（推奨）

```sql
SELECT cron.schedule(
  'comprehensive-token-refresh-weekly',
  '0 3 * * 0',  -- 毎週日曜3:00
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/comprehensive-token-refresh',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  ) AS request_id;
  $$
);
```

## 通知システム連携

### 通知カテゴリ

**トークン期限切れ間近**:
```typescript
{
  title: 'Token Expiring Soon',
  message: 'Token for @user123 will expire in 1 hour',
  type: 'warning',
  priority: 'high',
  category: 'account'
}
```

**トークン更新失敗**:
```typescript
{
  title: 'Token Refresh Failed',
  message: 'Failed to refresh 3 token(s): @user1, @user2, @user3',
  type: 'error',
  priority: 'high',
  category: 'account',
  action_url: '/accounts/main',
  action_label: 'View Accounts'
}
```

**アカウントサスペンド検知**:
```typescript
{
  title: 'Account Suspended',
  message: 'Account @spam_user_50 has been suspended by Twitter',
  type: 'error',
  priority: 'urgent',
  category: 'account'
}
```

## デプロイ手順

### 1. Edge Functions デプロイ

```bash
cd /home/user/xlo-system

# 個別デプロイ
supabase functions deploy auto-token-refresh
supabase functions deploy refresh-expired-tokens
supabase functions deploy comprehensive-token-refresh
supabase functions deploy validate-and-refresh-tokens

# または一括デプロイ
supabase functions deploy
```

### 2. 環境変数設定

Supabase Dashboard → Settings → Edge Functions → Environment variables

必要な環境変数:
- `TWITTER_CLIENT_ID` - Twitter OAuth 2.0 Client ID
- `TWITTER_CLIENT_SECRET` - Twitter OAuth 2.0 Client Secret
- `APP_URL` - アプリケーションURL（リダイレクト用）

**注意**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` は自動注入されます。

### 3. Cronジョブ設定

Supabase Dashboard → Database → Extensions → pg_cron を有効化

上記のCronスケジュールSQLを実行。

### 4. 動作確認

```bash
# auto-token-refresh テスト
curl -X POST \
  "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/auto-token-refresh" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

# 期待レスポンス:
# {
#   "success": true,
#   "message": "No tokens require refreshing",
#   "refreshed": 0,
#   "failed": 0,
#   "skipped": 0
# }
```

## 運用ガイドライン

### トークン更新頻度

**OAuth 2.0**:
- アクセストークン有効期限: 2時間
- 自動更新: 有効期限1時間前
- リフレッシュトークン: 無期限（再利用可能）

**推奨スケジュール**:
- 毎時: 期限切れ間近のトークン更新（auto-token-refresh）
- 毎日: 全トークンの健全性チェック
- 毎週: 包括的検証とクリーンアップ

### トラブルシューティング

**エラー: "Failed to refresh token"**

原因と対処:
1. Twitter App認証情報が間違っている
   → 環境変数を確認

2. Refresh Tokenが無効化された
   → ユーザーが手動で取り消した可能性
   → 再認証が必要

3. アカウントがサスペンドされた
   → is_suspended: true に更新される
   → ユーザーに通知

**エラー: "Connection test failed"**

原因と対処:
1. Twitter APIがダウン
   → 一時的な問題、自動リトライ

2. レート制限到達
   → 1時間後に自動回復

3. アカウント凍結
   → 手動確認が必要

### モニタリング

Supabase Dashboard → Logs → Edge Functions

監視項目:
- 実行頻度: 1時間ごと
- 成功率: > 95%
- 平均実行時間: < 30秒
- エラー率: < 5%

## セキュリティ

### トークン保存

**推奨**: 暗号化して保存
```sql
-- 将来的な暗号化実装例
ALTER TABLE account_tokens
  ADD COLUMN encrypted_access_token bytea,
  ADD COLUMN encrypted_refresh_token bytea;
```

### アクセス制御

- Service Role Key使用（admin権限）
- RLS有効でユーザー間分離
- Edge Functionsは認証必須

## 次のステップ（Phase 3）

Phase 2完了後、以下を実装:

1. **エンゲージメント自動化Edge Functions**
   - execute-auto-engagement
   - auto-unfollow-scheduler

2. **プロキシ管理強化**
   - プロキシ割当ロジック
   - 失敗率管理

3. **UI実装**
   - トークン管理UI
   - 通知センター
   - ダッシュボード

## ファイル一覧

```
supabase/functions/
├── auto-token-refresh/
│   └── index.ts              # 期限切れ間近トークン自動更新
├── refresh-expired-tokens/
│   └── index.ts              # 期限切れトークン一括更新
├── comprehensive-token-refresh/
│   └── index.ts              # 包括的トークン検証
└── validate-and-refresh-tokens/
    └── index.ts              # トークン検証（他関数用）
```

## まとめ

✅ **完了**: 4つのトークン自動更新Edge Functions実装
✅ **Cron対応**: 自動実行スケジュール設定可能
✅ **通知連携**: エラー時の自動通知
✅ **並列処理**: 効率的なバッチ処理
✅ **エラーハンドリング**: サスペンド検知と無効化

**次の実装**: Phase 3 - エンゲージメント自動化 & プロキシ管理

---

**実装日**: 2025-11-12
**ステータス**: ✅ 完了
