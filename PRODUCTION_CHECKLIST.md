# 本番環境デプロイチェックリスト

システムを本番環境にデプロイする前の最終確認リストです。

---

## 📋 デプロイ前チェックリスト

### ✅ Supabase セットアップ

#### データベース
- [ ] プロジェクト作成完了
- [ ] データベースパスワード記録済み
- [ ] リージョン選択済み（推奨: 日本またはシンガポール）

#### マイグレーション実行（順番厳守）
- [ ] `20251110_initial_schema.sql` 実行完了
- [ ] `20251112_add_missing_tables.sql` 実行完了
- [ ] `20251112_add_bulk_post_queue.sql` 実行完了
- [ ] `20251112_complete_schema.sql` 実行完了
- [ ] `20251112_hardening.sql` 実行完了
- [ ] `20251113_add_app_id_to_account_tokens.sql` 実行完了
- [ ] `20251113_add_oauth_sessions_columns.sql` 実行完了
- [ ] `20251113_add_rls_policies.sql` 実行完了 ⚠️ **必須**
- [ ] `20251113_add_account_health_tracking.sql` 実行完了 ⚠️ **必須**

#### Edge Functions デプロイ（全12個）
- [ ] `twitter-oauth-start` デプロイ完了
- [ ] `twitter-oauth-callback-v2` デプロイ完了
- [ ] `twitter-api-proxy` デプロイ完了 ⚠️ **コア機能**
- [ ] `validate-and-refresh-tokens` デプロイ完了
- [ ] `auto-token-refresh` デプロイ完了
- [ ] `comprehensive-token-refresh` デプロイ完了
- [ ] `refresh-expired-tokens` デプロイ完了
- [ ] `execute-auto-engagement` デプロイ完了
- [ ] `execute-bulk-posts` デプロイ完了
- [ ] `execute-loop` デプロイ完了
- [ ] `schedule-loop-execution` デプロイ完了
- [ ] `auto-unfollow-scheduler` デプロイ完了

#### 環境変数設定（Edge Functions）
```env
SUPABASE_URL=<Project URL>
SUPABASE_SERVICE_ROLE_KEY=<Service Role Key>
SUPABASE_ANON_KEY=<Anon Public Key>
```
- [ ] `SUPABASE_URL` 設定済み
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 設定済み ⚠️ **秘密情報**
- [ ] `SUPABASE_ANON_KEY` 設定済み

#### 削除する環境変数
- [ ] `TWITTER_CLIENT_ID` **削除済み**（DBから取得）
- [ ] `TWITTER_CLIENT_SECRET` **削除済み**（DBから取得）

#### 認証設定
- [ ] Email認証を有効化
- [ ] Confirm email設定（本番: ON, 開発: OFF）
- [ ] Site URL設定（VercelのURL）
- [ ] Redirect URLs設定（VercelのURL）

#### API設定取得
- [ ] Project URL 取得・記録
- [ ] anon public key 取得・記録
- [ ] service_role key 取得・記録 ⚠️ **秘密**

---

### ✅ Vercel セットアップ

#### プロジェクト設定
- [ ] GitHubリポジトリ連携
- [ ] プロジェクトインポート完了
- [ ] ビルド設定確認（Next.js）

#### 環境変数設定
```env
NEXT_PUBLIC_SUPABASE_URL=<Supabase Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase Anon Key>
NEXT_PUBLIC_APP_URL=<Vercel Deployment URL>
```
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 設定済み
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 設定済み
- [ ] `NEXT_PUBLIC_APP_URL` 設定済み

#### デプロイ
- [ ] 初回デプロイ成功
- [ ] ビルドエラーなし
- [ ] デプロイURLアクセス可能
- [ ] プロダクションドメイン設定（オプション）

---

### ✅ Twitter Developer Portal セットアップ

#### App作成準備（ユーザー向け手順）
- [ ] Developer Account取得済み
- [ ] プロジェクト作成
- [ ] App作成

#### OAuth 2.0設定
```
Type of App: Web App, Automated App or Bot
Callback URL: https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/twitter-oauth-callback-v2
Website URL: <Vercel Deployment URL>
```
- [ ] OAuth 2.0有効化
- [ ] Callback URL設定
- [ ] Website URL設定
- [ ] Read and Write権限設定

#### 認証情報
- [ ] Client ID (API Key) 取得
- [ ] Client Secret (API Secret) 取得
- [ ] Bearer Token 取得（オプション、検索用）

---

### ✅ 初期動作確認

#### ユーザー登録・ログイン
- [ ] ユーザー登録可能
- [ ] メール確認（本番時）
- [ ] ログイン成功
- [ ] ログアウト成功

#### Twitter Apps管理
- [ ] Twitter Appページアクセス可能
- [ ] Twitter App登録可能
- [ ] Callback URL正しく表示
- [ ] Twitter App編集可能
- [ ] Twitter App削除可能

#### アカウント連携
- [ ] OAuth連携ボタン動作
- [ ] Twitter OAuth画面表示
- [ ] 認証成功
- [ ] リダイレクト成功
- [ ] アカウント自動作成
- [ ] トークン保存確認

#### 基本機能テスト
- [ ] メインアカウント一覧表示
- [ ] スパムアカウント一覧表示
- [ ] フォローアカウント一覧表示
- [ ] テンプレート作成可能
- [ ] 投稿作成可能
- [ ] ループ作成可能
- [ ] エンゲージメントルール作成可能

---

### ✅ セキュリティ確認

#### Row Level Security (RLS)
```sql
-- 全テーブルでRLS有効確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false;
```
- [ ] 全テーブルでRLS有効（結果0件）
- [ ] ポリシー設定確認
- [ ] 他ユーザーのデータアクセス不可確認

#### 環境変数保護
- [ ] Service Role Key が公開されていない
- [ ] .env.local が .gitignore に含まれる
- [ ] 本番環境変数がVercelのみに設定

#### 認証テスト
- [ ] 未ログイン時のリダイレクト動作
- [ ] 不正トークンでのアクセス拒否
- [ ] CORS設定正常

---

### ✅ パフォーマンス確認

#### フロントエンド
- [ ] Lighthouseスコア80以上
- [ ] ページ読み込み時間3秒以内
- [ ] 画像最適化確認
- [ ] バンドルサイズ確認

#### バックエンド
- [ ] Edge Function応答時間5秒以内
- [ ] データベースクエリ最適化
- [ ] インデックス設定確認

---

### ✅ 大量稼働準備

#### データベース関数確認
```sql
-- 健全性管理関数の存在確認
SELECT proname
FROM pg_proc
WHERE proname IN (
  'record_account_success',
  'record_account_error',
  'can_account_make_request',
  'reset_daily_request_counters'
);
```
- [ ] 4つの関数すべて存在

#### テーブル確認
```sql
-- 健全性トラッキングカラム確認
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'main_accounts'
AND column_name IN ('health_score', 'consecutive_errors', 'daily_request_count');
```
- [ ] 健全性カラム存在確認
- [ ] account_request_log テーブル存在

#### レート制限テスト
- [ ] アカウント選択時の健全性チェック動作
- [ ] レート制限超過時のリクエスト拒否
- [ ] 健全性スコア更新動作
- [ ] 自動停止動作（5連続エラー）

---

### ✅ Cron設定（オプション）

#### Supabase Cron Jobs
```sql
-- トークン自動更新（1時間ごと）
SELECT cron.schedule(...);

-- ループ実行（15分ごと）
SELECT cron.schedule(...);

-- 日次カウンターリセット（毎日0時）
SELECT cron.schedule(...);
```
- [ ] auto-token-refresh スケジュール設定
- [ ] execute-loops スケジュール設定
- [ ] reset-daily-counters スケジュール設定

---

### ✅ ドキュメント確認

- [ ] README.md 最新版
- [ ] DEPLOYMENT_GUIDE.md 存在
- [ ] MASS_OPERATION_GUIDE.md 存在
- [ ] 環境変数テンプレート存在

---

### ✅ モニタリング準備

#### Supabase Dashboard
- [ ] ログ確認方法理解
- [ ] メトリクス確認方法理解
- [ ] データベースサイズ監視設定

#### Vercel Dashboard
- [ ] アクセスログ確認方法理解
- [ ] エラーログ監視設定
- [ ] アラート設定（オプション）

#### 健全性監視SQL準備
```sql
-- 日次実行推奨
SELECT handle, health_score, consecutive_errors
FROM main_accounts
WHERE health_score < 50;
```
- [ ] 監視クエリ保存済み
- [ ] 実行方法理解

---

### ✅ バックアップ計画

- [ ] データベース自動バックアップ確認（Supabase）
- [ ] リポジトリバックアップ（GitHub）
- [ ] 環境変数のバックアップ（安全な場所）

---

### ✅ 緊急時対応

#### ロールバック手順
- [ ] Vercelロールバック方法理解
- [ ] データベースマイグレーションロールバック手順理解

#### サポート連絡先
- [ ] Supabaseサポート連絡先確認
- [ ] Vercelサポート連絡先確認
- [ ] Twitter Developer サポート確認

---

## 🚀 デプロイ実行

### 最終確認
- [ ] 上記すべてのチェック完了
- [ ] テストアカウントで動作確認完了
- [ ] バックアップ取得完了

### デプロイGo判断
- [ ] チーム承認取得（該当する場合）
- [ ] メンテナンス時間設定（該当する場合）
- [ ] ロールバック手順確認

### デプロイ後24時間監視
- [ ] エラーログ監視
- [ ] パフォーマンス監視
- [ ] ユーザー登録数確認
- [ ] アカウント連携成功率確認

---

## 📊 成功指標

### 初日（0-24時間）
- [ ] ビルドエラーなし
- [ ] 認証成功率 > 95%
- [ ] OAuth連携成功率 > 90%
- [ ] ページ読み込み時間 < 3秒

### 初週（1-7日）
- [ ] アカウント健全性スコア平均 > 80
- [ ] エラー率 < 10%
- [ ] 自動停止アカウント数 < 5%
- [ ] ユーザー満足度確認

---

## ⚠️ 要注意事項

### 絶対にやってはいけないこと
- ❌ Service Role Key の公開
- ❌ RLSポリシーの無効化
- ❌ マイグレーションの順番変更
- ❌ 本番DBへの直接SQL実行（バックアップなし）
- ❌ 環境変数の誤設定（本番↔開発混同）

### 推奨事項
- ✅ 小規模から開始（5-10アカウント）
- ✅ 段階的なスケールアップ
- ✅ 定期的な健全性チェック
- ✅ ログの定期確認
- ✅ ユーザーフィードバック収集

---

## 🎉 デプロイ完了後

- [ ] チームへの報告
- [ ] ユーザーへのアナウンス（該当する場合）
- [ ] ドキュメントの最終更新
- [ ] 次期アップデート計画策定

---

**すべてのチェックが完了したら、本番環境デプロイの準備完了です！🚀**
