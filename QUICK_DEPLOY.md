# 🚀 クイックデプロイガイド

## 現在の状況

- **Git Push**: ✅ 完了 (ブランチ: `claude/twitter-automation-system-dev-011CV3mRd9bjC5anRNPrW5da`)
- **Vercel**: ⚠️  手動トリガー必要
- **Supabase Edge Functions**: ⚠️  デプロイ必要

---

## 1️⃣ Vercel デプロイ（1分で完了）

### オプションA: ダッシュボードから（推奨）

1. https://vercel.com/dashboard にアクセス
2. プロジェクト `xlo-system` を選択
3. 「Deployments」タブ → 「Deploy」ボタンをクリック
4. ブランチ選択: `claude/twitter-automation-system-dev-011CV3mRd9bjC5anRNPrW5da`
5. 「Deploy」をクリック

**デプロイURL**: https://xlo-system-nygx6oglc-sakamoto334422-gmailcoms-projects.vercel.app

### オプションB: 自動デプロイ設定確認

Vercelが既にGitHubと連携している場合、pushで自動デプロイされている可能性があります。

確認方法:
- Vercel Dashboard → Settings → Git
- 監視ブランチに `claude/twitter-automation-system-dev-011CV3mRd9bjC5anRNPrW5da` が含まれているか確認

---

## 2️⃣ Supabase Edge Functions デプロイ（10分）

### 必要なもの
- Supabase CLI（インストール手順は下記）
- Supabaseアカウントへのアクセス

### ステップ1: Supabase CLI インストール

**macOS (Homebrew):**
```bash
brew install supabase/tap/supabase
```

**Windows (Scoop):**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Linux:**
```bash
# Homebrewを使用
brew install supabase/tap/supabase

# またはバイナリを直接ダウンロード
# https://github.com/supabase/cli/releases
```

**npm (非推奨だがnpxは可能):**
```bash
npx supabase --version
```

### ステップ2: ログイン

```bash
supabase login
```

ブラウザが開くのでSupabaseアカウントでログイン。

### ステップ3: プロジェクトディレクトリに移動

```bash
cd /home/user/xlo-system
```

### ステップ4: プロジェクトリンク

```bash
supabase link --project-ref swyiwqzlmozlqircyyzr
```

データベースパスワード入力を求められたら: `XLO20251110@`

### ステップ5: デプロイスクリプト実行

```bash
./deploy-functions.sh
```

このスクリプトは以下の13個のEdge Functionsをデプロイします:
- twitter-oauth-start
- twitter-oauth-callback-v2
- validate-and-refresh-tokens
- auto-token-refresh
- comprehensive-token-refresh
- refresh-expired-tokens
- execute-auto-engagement
- auto-unfollow-scheduler
- execute-bulk-posts
- execute-loop
- schedule-loop-execution
- twitter-api-proxy

### ステップ6: 環境変数設定

Supabaseダッシュボードで環境変数を設定:

1. https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/settings/functions にアクセス
2. 「Secrets」タブを選択
3. 以下の環境変数を追加:

```
SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo
TWITTER_API_KEY=（Twitter Developer PortalのAPI Key）
TWITTER_API_SECRET=（Twitter Developer PortalのAPI Secret）
TWITTER_BEARER_TOKEN=（Twitter Developer PortalのBearer Token）
```

---

## 3️⃣ 個別デプロイコマンド（必要に応じて）

特定のFunctionのみデプロイする場合:

```bash
# OAuth関連
supabase functions deploy twitter-oauth-start --no-verify-jwt
supabase functions deploy twitter-oauth-callback-v2 --no-verify-jwt

# トークン管理
supabase functions deploy validate-and-refresh-tokens --no-verify-jwt
supabase functions deploy auto-token-refresh --no-verify-jwt
supabase functions deploy comprehensive-token-refresh --no-verify-jwt
supabase functions deploy refresh-expired-tokens --no-verify-jwt

# エンゲージメント
supabase functions deploy execute-auto-engagement --no-verify-jwt
supabase functions deploy auto-unfollow-scheduler --no-verify-jwt

# 投稿・ループ
supabase functions deploy execute-bulk-posts --no-verify-jwt
supabase functions deploy execute-loop --no-verify-jwt
supabase functions deploy schedule-loop-execution --no-verify-jwt

# プロキシ
supabase functions deploy twitter-api-proxy --no-verify-jwt
```

---

## 4️⃣ デプロイ確認

### Vercel確認

```bash
# ブラウザでアクセス
https://xlo-system-nygx6oglc-sakamoto334422-gmailcoms-projects.vercel.app
```

以下を確認:
- ダッシュボードが表示される
- ログインできる
- 各ページ（メインアカウント、フォローアカウント、スパムアカウント等）が動作する

### Supabase Edge Functions確認

```bash
# デプロイ済みFunction一覧
supabase functions list

# 特定のFunctionのログ確認
supabase functions logs execute-auto-engagement --limit 50
```

**またはダッシュボード:**
- https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/functions
- 各Functionをクリックしてステータス確認

---

## トラブルシューティング

### Vercel: ビルドエラー

**症状**: デプロイが失敗する

**解決方法**:
```bash
# ローカルでビルドテスト
npm install
npm run build

# エラーがあれば修正してpush
git add .
git commit -m "fix: build errors"
git push -u origin claude/twitter-automation-system-dev-011CV3mRd9bjC5anRNPrW5da
```

### Supabase: 認証エラー

**症状**: `supabase login` が失敗する

**解決方法**:
```bash
supabase logout
supabase login
```

### Supabase: プロジェクトリンクエラー

**症状**: `supabase link` が失敗する

**解決方法**:
```bash
# 既存のリンクを削除
rm -rf .supabase

# 再リンク
supabase link --project-ref swyiwqzlmozlqircyyzr
```

### Supabase: Function デプロイエラー

**症状**: 特定のFunctionがデプロイできない

**解決方法**:
```bash
# デバッグモードで再デプロイ
supabase functions deploy <function-name> --no-verify-jwt --debug

# ローカルでテスト
supabase functions serve <function-name>
```

---

## まとめチェックリスト

デプロイ完了の確認:

- [ ] Vercelデプロイ完了（https://xlo-system-nygx6oglc-sakamoto334422-gmailcoms-projects.vercel.app にアクセス可能）
- [ ] ダッシュボードが正常に表示される
- [ ] Supabase CLI インストール完了
- [ ] Supabase にログイン完了
- [ ] プロジェクトリンク完了
- [ ] 13個のEdge Functions すべてデプロイ完了
- [ ] Supabase環境変数設定完了
- [ ] Edge Functionsがステータス「active」になっている

すべてチェックが入ったら **デプロイ完了** です！ 🎉

---

## サポート

問題が発生した場合:
1. `DEPLOYMENT_GUIDE.md` の詳細ガイドを参照
2. Vercel/Supabaseのログを確認
3. GitHub Issuesで報告

管理者: sakasho0123@gmail.com
