# デプロイガイド

## Vercel 手動デプロイ手順

### ダッシュボードから（推奨・最速）

1. **Vercel ダッシュボードにアクセス**
   - https://vercel.com/dashboard にアクセス
   - プロジェクト `xlo-system` を選択

2. **最新のブランチをデプロイ**
   - 「Deployments」タブをクリック
   - 右上の「Deploy」ボタンをクリック
   - Branch: `claude/twitter-automation-system-dev-011CV3mRd9bjC5anRNPrW5da` を選択
   - 「Deploy」をクリック

3. **デプロイ確認**
   - ビルドログを確認
   - 完了後、`xlo-system-nygx6oglc-sakamoto334422-gmailcoms-projects.vercel.app` にアクセス

### または Git Push でトリガー（自動）

現在のブランチは既にpush済みなので、Vercelが自動デプロイ設定されていれば数分で反映されます。

**確認方法:**
- Vercel Dashboard → Settings → Git
- ブランチ `claude/twitter-automation-system-dev-011CV3mRd9bjC5anRNPrW5da` が監視対象か確認

---

## Supabase Edge Functions デプロイ手順

### 必要なEdge Functions一覧（13個）

以下のEdge Functionsをデプロイする必要があります：

1. **twitter-oauth-start** - OAuth認証開始
2. **twitter-oauth-callback-v2** - OAuth コールバック処理
3. **validate-and-refresh-tokens** - トークン検証・更新
4. **auto-token-refresh** - 自動トークンリフレッシュ
5. **comprehensive-token-refresh** - 包括的トークン更新
6. **refresh-expired-tokens** - 期限切れトークン更新
7. **execute-auto-engagement** - 自動エンゲージメント実行
8. **auto-unfollow-scheduler** - 自動アンフォロースケジューラー
9. **execute-bulk-posts** - 一括投稿実行
10. **execute-loop** - ループ実行
11. **schedule-loop-execution** - ループスケジューリング
12. **twitter-api-proxy** - Twitter APIプロキシ

### 方法1: Supabase ダッシュボードから（GUI）

1. **Supabaseダッシュボードにアクセス**
   - https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr にアクセス

2. **Edge Functions セクション**
   - 左メニューから「Edge Functions」を選択
   - 「Deploy new function」をクリック

3. **各Functionをデプロイ**
   - Function name: 例 `execute-auto-engagement`
   - Code: `/supabase/functions/execute-auto-engagement/index.ts` の内容をコピペ
   - 「Deploy function」をクリック
   - 上記13個すべてに対して繰り返し

### 方法2: Supabase CLI を使う（推奨・一括デプロイ）

#### ステップ1: Supabase CLI インストール

```bash
# npm経由でインストール
npm install -g supabase

# または
curl -fsSL https://cli.supabase.com/install.sh | sh
```

#### ステップ2: ログイン

```bash
supabase login
```

ブラウザが開くので、Supabaseアカウントでログイン。

#### ステップ3: プロジェクトにリンク

```bash
cd /home/user/xlo-system
supabase link --project-ref swyiwqzlmozlqircyyzr
```

プロンプトが表示されたら、データベースパスワード `XLO20251110@` を入力。

#### ステップ4: すべてのEdge Functionsをデプロイ

```bash
# 個別にデプロイ
supabase functions deploy twitter-oauth-start
supabase functions deploy twitter-oauth-callback-v2
supabase functions deploy validate-and-refresh-tokens
supabase functions deploy auto-token-refresh
supabase functions deploy comprehensive-token-refresh
supabase functions deploy refresh-expired-tokens
supabase functions deploy execute-auto-engagement
supabase functions deploy auto-unfollow-scheduler
supabase functions deploy execute-bulk-posts
supabase functions deploy execute-loop
supabase functions deploy schedule-loop-execution
supabase functions deploy twitter-api-proxy

# または一括デプロイスクリプト（下記参照）
```

#### ステップ5: 環境変数設定

各Edge Functionに必要な環境変数を設定：

```bash
# Supabaseダッシュボード → Settings → Edge Functions → Secrets
# 以下を追加:

SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（service roleキー）
TWITTER_API_KEY=（Twitter API Key）
TWITTER_API_SECRET=（Twitter API Secret）
TWITTER_BEARER_TOKEN=（Twitter Bearer Token）
```

### 一括デプロイスクリプト

```bash
#!/bin/bash

FUNCTIONS=(
  "twitter-oauth-start"
  "twitter-oauth-callback-v2"
  "validate-and-refresh-tokens"
  "auto-token-refresh"
  "comprehensive-token-refresh"
  "refresh-expired-tokens"
  "execute-auto-engagement"
  "auto-unfollow-scheduler"
  "execute-bulk-posts"
  "execute-loop"
  "schedule-loop-execution"
  "twitter-api-proxy"
)

for func in "${FUNCTIONS[@]}"; do
  echo "Deploying $func..."
  supabase functions deploy "$func" --no-verify-jwt
  if [ $? -eq 0 ]; then
    echo "✅ $func deployed successfully"
  else
    echo "❌ $func deployment failed"
  fi
done

echo "All functions deployed!"
```

### デプロイ確認

```bash
# デプロイ済みFunction一覧を確認
supabase functions list

# 特定のFunctionをテスト
supabase functions serve execute-auto-engagement
```

---

## クイックスタート（推奨フロー）

### 1. Vercel デプロイ（1分）
1. https://vercel.com/dashboard にアクセス
2. プロジェクト `xlo-system` → Deployments
3. 「Deploy」→ ブランチ選択 → 実行

### 2. Supabase Edge Functions デプロイ（10分）

**Supabase CLI を今すぐインストールして実行:**

```bash
# CLIインストール
npm install -g supabase

# ログイン
supabase login

# プロジェクトリンク
cd /home/user/xlo-system
supabase link --project-ref swyiwqzlmozlqircyyzr

# 一括デプロイ（すべてのfunctions）
for func in twitter-oauth-start twitter-oauth-callback-v2 validate-and-refresh-tokens auto-token-refresh comprehensive-token-refresh refresh-expired-tokens execute-auto-engagement auto-unfollow-scheduler execute-bulk-posts execute-loop schedule-loop-execution twitter-api-proxy; do
  echo "Deploying $func..."
  supabase functions deploy "$func" --no-verify-jwt
done
```

---

## トラブルシューティング

### Vercel デプロイが失敗する場合

**ビルドエラー:**
```bash
# ローカルでビルドテスト
npm run build
```

**環境変数が未設定:**
- Vercel Dashboard → Settings → Environment Variables
- README.mdの環境変数をすべて設定

### Supabase Functions デプロイが失敗する場合

**認証エラー:**
```bash
supabase logout
supabase login
```

**プロジェクトリンクエラー:**
```bash
supabase unlink
supabase link --project-ref swyiwqzlmozlqircyyzr
```

**デプロイエラー:**
- Deno.jsonの設定確認
- import mapの整合性確認
- 各functionのindex.tsにシンタックスエラーがないか確認

---

## デプロイ後の確認

### Vercel
- https://xlo-system-nygx6oglc-sakamoto334422-gmailcoms-projects.vercel.app にアクセス
- ダッシュボードが正常に表示されるか確認
- ログインして各ページが動作するか確認

### Supabase Edge Functions
```bash
# Function一覧確認
supabase functions list

# 特定のFunctionのログ確認
supabase functions logs execute-auto-engagement
```

**または Supabaseダッシュボード:**
- Edge Functions → 各Function → Logs タブで実行ログ確認

---

## 注意事項

1. **環境変数**: Vercel、Supabase両方で正しく設定されているか確認
2. **Twitter API制限**: レート制限に注意
3. **データベースマイグレーション**: 既に実行済みか確認
4. **OAuth Redirect URL**: Vercelのドメインに合わせて更新

完了！
