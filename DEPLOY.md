# 🚀 XLO デプロイ手順書

## ステップ1: Supabaseマイグレーション実行

### 1-1. Supabaseダッシュボードにアクセス
https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr

### 1-2. SQL Editorを開く
左サイドバー → **SQL Editor**

### 1-3. マイグレーションSQL実行
1. **New Query** をクリック
2. `supabase/migrations/20251110_initial_schema.sql` の内容を全てコピー
3. エディタに貼り付け
4. **Run** ボタンをクリック (右下)
5. "Success. No rows returned" と表示されればOK

### 1-4. テーブル確認
左サイドバー → **Table Editor**
以下10個のテーブルが表示されていることを確認:
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

---

## ステップ2: GitHubにコードをプッシュ

### 2-1. ローカルでテスト (オプション)
```bash
cd xlo-system
npm install
npm run dev
```
http://localhost:3000 でアクセスして動作確認

### 2-2. GitHubにプッシュ

コマンドをターミナルで実行:

```bash
cd /path/to/xlo-system

# Git初期化
git init

# 全ファイルを追加
git add .

# コミット
git commit -m "Initial commit: XLO Phase 1"

# リモートリポジトリを追加
git remote add origin https://github.com/RenMurata-ops/xlo-system.git

# プッシュ
git branch -M main
git push -u origin main
```

### 2-3. プッシュ確認
https://github.com/RenMurata-ops/xlo-system にアクセスして、ファイルがアップロードされていることを確認

---

## ステップ3: Vercelデプロイ

### 3-1. Vercelプロジェクト設定
https://vercel.com/new にアクセス

### 3-2. GitHubリポジトリをインポート
1. **Import Git Repository** セクションで `RenMurata-ops/xlo-system` を選択
2. **Import** をクリック

### 3-3. プロジェクト設定

**Framework Preset**: Next.js (自動検出されます)

**Root Directory**: `./` (デフォルト)

### 3-4. 環境変数設定

**Environment Variables** セクションを展開し、以下を追加:

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://swyiwqzlmozlqircyyzr.supabase.co

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MzI4NjYsImV4cCI6MjA3ODMwODg2Nn0.MIbwT2_YIeCCVHjLF2fBFrTSpyvL7jnrqkj3sb7GMgE

Name: SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo

Name: DATABASE_URL
Value: postgresql://postgres:XLO20251110%40@db.swyiwqzlmozlqircyyzr.supabase.co:5432/postgres

Name: ADMIN_EMAIL
Value: sakasho0123@gmail.com
```

### 3-5. デプロイ実行
**Deploy** ボタンをクリック

### 3-6. デプロイ完了確認
- デプロイが完了するまで2-3分待つ
- "Congratulations!" と表示されたら成功
- **Visit** ボタンをクリックしてアプリにアクセス

---

## ステップ4: 動作確認

### 4-1. トップページ確認
デプロイされたURLにアクセス (例: https://xlo-system.vercel.app)

### 4-2. 管理者アカウント作成

#### Supabaseで手動作成:
1. Supabaseダッシュボード → **Authentication** → **Users**
2. **Add User** → **Create new user** をクリック
3. Email: `sakasho0123@gmail.com`
4. Password: 任意の強力なパスワード (8文字以上)
5. **Auto Confirm User** にチェック
6. **Create User** をクリック

### 4-3. ログインテスト
1. アプリのトップページ → **ログイン** ボタン
2. 作成したメールアドレスとパスワードを入力
3. **ログイン** をクリック
4. ダッシュボードが表示されれば成功！

---

## ✅ デプロイ完了チェックリスト

- [ ] Supabaseに10テーブルが作成されている
- [ ] GitHubにコードがプッシュされている
- [ ] Vercelで環境変数が設定されている
- [ ] デプロイが成功している
- [ ] トップページにアクセスできる
- [ ] 管理者アカウントが作成されている
- [ ] ログインしてダッシュボードにアクセスできる

---

## 🐛 トラブルシューティング

### デプロイが失敗する
- Vercelのログを確認
- 環境変数が正しく設定されているか確認
- GitHubのコードが最新か確認

### ログインできない
- Supabaseで管理者アカウントが作成されているか確認
- **Auto Confirm User** がチェックされているか確認
- パスワードが8文字以上か確認

### データベースエラー
- SupabaseのSQL Editorでマイグレーションが正常に実行されたか確認
- Table Editorで10テーブルが存在するか確認

---

## 📞 サポート

問題が発生した場合は、スクリーンショットとエラーメッセージを添えてご連絡ください。
