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

Vercelダッシュボードで以下の環境変数を設定:

```
NEXT_PUBLIC_SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MzI4NjYsImV4cCI6MjA3ODMwODg2Nn0.MIbwT2_YIeCCVHjLF2fBFrTSpyvL7jnrqkj3sb7GMgE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo
DATABASE_URL=postgresql://postgres:XLO20251110%40@db.swyiwqzlmozlqircyyzr.supabase.co:5432/postgres
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
ADMIN_EMAIL=sakasho0123@gmail.com
```

## 📋 Phase 1 (Day 1) - 実装済み

### ✅ 完了した機能

- [x] Next.js 15 プロジェクトセットアップ
- [x] Supabase 接続設定
- [x] 認証システム (ログイン)
- [x] ダッシュボード基本UI
- [x] データベーススキーマ (10テーブル)
  - account_tokens
  - main_accounts
  - follow_accounts
  - spam_accounts
  - posts
  - twitter_apps
  - auto_engagement_rules
  - loops
  - proxies
  - nordvpn_accounts

### 🎨 UI コンポーネント

- Button
- Input
- Label
- Card

## 📅 次のステップ (Day 2-3)

### Day 2: エンゲージメント機能
- [ ] 残りのテーブル追加 (27テーブル)
- [ ] Twitter OAuth 認証フロー
- [ ] アカウント管理UI (3種類)
- [ ] 投稿管理UI
- [ ] Edge Functions実装

### Day 3: 完成 & 調整
- [ ] NordVPN統合UI
- [ ] 自動エンゲージメントUI
- [ ] ループ実行UI
- [ ] 総合テスト
- [ ] パフォーマンス最適化

## 🛠️ 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **UI**: Radix UI + Shadcn/ui
- **状態管理**: TanStack Query
- **バックエンド**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **デプロイ**: Vercel

## 📞 サポート

管理者: sakasho0123@gmail.com
