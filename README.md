# XLO - X (Twitter) Automation Platform

X (Twitter) の自動投稿・エンゲージメント管理プラットフォーム

## 🚀 セットアップ手順

### 1. Supabaseでマイグレーション実行

1. Supabaseダッシュボードにアクセス
2. **SQL Editor** を開く
3. `supabase/migrations/20251110_initial_schema.sql` の内容をコピー
4. SQL Editorに貼り付けて **Run** をクリック

### 2. ローカル開発環境

```bash
# パッケージインストール
npm install

# 開発サーバー起動
npm run dev
```

http://localhost:3000 でアクセス

### 3. Vercelデプロイ

#### 環境変数設定

**重要**: 秘密情報は `.env.local` に設定してください。`.env.example` をコピーして使用してください。

```bash
cp .env.example .env.local
# .env.local を編集して実際の値を設定
```

Vercelダッシュボードで以下の環境変数を設定:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key (⚠️ 秘密情報)
- `DATABASE_URL`: PostgreSQL接続文字列 (⚠️ 秘密情報)
- `NEXT_PUBLIC_APP_URL`: アプリケーションURL
- `ADMIN_EMAIL`: 管理者メールアドレス

設定値はSupabaseダッシュボード ( https://supabase.com/dashboard ) から取得してください。

## ✅ 実装完了 - STAGE1 ~ STAGE6

### 🎯 全機能実装済み (Production Ready)

**STAGE1 - 基本セットアップ**
- [x] Next.js 15 プロジェクトセットアップ
- [x] Supabase 接続設定
- [x] 認証システム (ログイン)
- [x] ダッシュボード基本UI

**STAGE2 - データベース & スキーマ**
- [x] 完全なデータベーススキーマ (27+ テーブル)
- [x] Row Level Security (RLS) ポリシー
- [x] Views & Functions
- [x] Indexes & Constraints

**STAGE3 - Edge Functions & API**
- [x] Twitter OAuth 認証フロー
- [x] twitter-api-proxy (多テナント対応)
- [x] execute-bulk-posts
- [x] execute-loop
- [x] execute-auto-engagement
- [x] schedule-loop-execution (Cron)

**STAGE4 - ループ実行システム**
- [x] ループ管理UI (作成・編集・実行)
- [x] ループ実行ログ
- [x] 重複検出 (24時間ウィンドウ)
- [x] ループロック機能

**STAGE5 - アカウント & テンプレート管理**
- [x] メインアカウント管理UI
- [x] スパムアカウント管理UI
- [x] フォローアカウント管理UI
- [x] テンプレート管理UI (post/reply/cta)
- [x] プロキシ管理UI
- [x] Twitter Apps管理UI

**STAGE6 - UI強化 & 統合** ✨ **NEW**
- [x] Toast通知システム (Sonner)
- [x] CSV一括インポート
- [x] アカウントヘルスチェック (個別 & 一括)
- [x] テンプレート使用統計 (recharts)
- [x] 投稿プレビューモーダル
- [x] NordVPNプロキシ自動割当 (ラウンドロビン & ランダム)

### 🎨 主要機能

**アカウント管理**
- 500アカウント対応
- CSV一括インポート
- ヘルスチェック機能
- プロキシ自動割当
- 認証状態モニタリング

**投稿管理**
- 下書き・予約・投稿済み管理
- 一括投稿実行
- プレビュー機能
- メディア対応

**自動エンゲージメント**
- キーワード/ハッシュタグ/ユーザー検索
- like/reply/retweet/follow/quote アクション
- フィルタリング (フォロワー数、アカウント年齢)
- テンプレート統合
- 実行ログ (trace_id付き)

**ループ実行**
- スケジュール実行
- 複数アカウント対応
- 重複検出・防止
- ロック機能

**統計 & モニタリング**
- リアルタイムレート制限モニター
- ループロック状態表示
- 重複エラー表示
- テンプレート使用統計

### 📦 完成済みコンポーネント

**Forms**: AccountForm (3種類), TemplateForm, PostForm, ProxyForm, LoopForm, TwitterAppForm, EngagementRuleForm

**Modals**: CSVImportModal, PostPreview, TemplatePreview, TemplateStats

**Cards**: AccountCard (3種類), TemplateCard, PostCard, ProxyCard, LoopCard, TwitterAppCard, EngagementRuleCard

**Monitoring**: RateLimitMonitor, LoopLockMonitor, DuplicateAttemptsMonitor

**History**: EngagementHistory, LoopExecutionHistory

## 🛠️ 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **UI**: Radix UI + Shadcn/ui
- **状態管理**: TanStack Query
- **バックエンド**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **デプロイ**: Vercel

## 📊 実装状況

- **総コミット数**: 30+ commits
- **総ファイル数**: 100+ files
- **実装期間**: 2025-11-10 ~ 2025-11-17 (8日間)
- **デプロイ状況**: ✅ Production (Vercel)
- **データベース**: ✅ Supabase (PostgreSQL)
- **Edge Functions**: ✅ Deployed (7 functions)

## 📝 ドキュメント

- `STAGE6_COMPLETION_SUMMARY.md` - STAGE6完了サマリー
- `STAGE6_IMPLEMENTATION.md` - STAGE6実装ガイド
- `STAGE2_IMPLEMENTATION.md` ~ `STAGE5_IMPLEMENTATION.md` - 各ステージガイド
- `DEPLOY.md` - デプロイ手順

## 🚀 次のステップ

XLO Systemは全機能実装完了。本番運用可能な状態です。

**推奨される次のアクション**:
1. Supabaseデータベースにマイグレーション適用
2. プロキシ設定 (NordVPN連携)
3. Twitter Apps登録
4. 初期アカウント登録
5. テンプレート作成
6. 本番運用開始

## 📞 サポート

管理者: sakasho0123@gmail.com
プロジェクト: XLO - Twitter Automation Platform
