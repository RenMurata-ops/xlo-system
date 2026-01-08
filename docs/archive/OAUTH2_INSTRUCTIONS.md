# OAuth 2.0 認証手順

## ステップ1: ログイン
1. ブラウザで http://localhost:3002 が開きます
2. 既存のアカウントでログイン

## ステップ2: Twitter連携
1. サイドバーまたはメニューから **"Twitter Accounts"** または **"Accounts"** ページに移動
2. **"Connect Twitter Account"** または **"Add Twitter Account"** ボタンをクリック
3. Twitter OAuth 2.0画面が開きます

## ステップ3: Twitter認証
1. Twitterアカウント（BelviaCard60876）でログイン
2. アプリへのアクセス許可を承認
3. 自動的にアプリにリダイレクト

## ステップ4: 完了確認
認証完了後、以下のコマンドを実行してください：

```bash
# トークン確認
curl -s -X POST "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/check-tokens" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MzI4NjYsImV4cCI6MjA3ODMwODg2Nn0.MIbwT2_YIeCCVHjLF2fBFrTSpyvL7jnrqkj3sb7GMgE" \
  -H "Content-Type: application/json" | jq '.tokens[] | select(.x_username=="BelviaCard60876")'

# E2Eテスト実行
curl -s -X POST "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-auto-engagement" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MzI4NjYsImV4cCI6MjA3ODMwODg2Nn0.MIbwT2_YIeCCVHjLF2fBFrTSpyvL7jnrqkj3sb7GMgE" \
  -H "Content-Type: application/json" | jq '.results[] | {rule_name, status, searched, actions_succeeded, actions_failed}'
```

## トラブルシューティング

### Twitter Appページが見つからない場合
アプリのルーティングを確認：
```bash
find . -name "*.tsx" -o -name "*.ts" | grep -i "twitter\|account" | head -20
```

### 認証エラーが発生した場合
Twitter App設定を確認：
- Callback URL: http://localhost:3002/auth/callback
- App permissions: Read and Write
