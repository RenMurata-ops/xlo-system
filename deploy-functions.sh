#!/bin/bash

# Supabase Edge Functions 一括デプロイスクリプト
# 使用方法: ./deploy-functions.sh

set -e

echo "🚀 Supabase Edge Functions デプロイ開始"
echo ""

# プロジェクトリファレンス
PROJECT_REF="swyiwqzlmozlqircyyzr"

# デプロイするFunctions一覧
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

# Supabase CLIがインストールされているか確認
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI がインストールされていません"
    echo ""
    echo "以下のコマンドでインストールしてください:"
    echo ""
    echo "macOS/Linux:"
    echo "  brew install supabase/tap/supabase"
    echo ""
    echo "Windows (Scoop):"
    echo "  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git"
    echo "  scoop install supabase"
    echo ""
    echo "または https://supabase.com/docs/guides/cli を参照"
    exit 1
fi

echo "✅ Supabase CLI が見つかりました"
echo ""

# ログイン確認
echo "🔐 Supabase にログインしています..."
if ! supabase projects list &> /dev/null; then
    echo "❌ ログインが必要です"
    echo "以下のコマンドを実行してください:"
    echo "  supabase login"
    exit 1
fi

echo "✅ ログイン済み"
echo ""

# プロジェクトリンク確認
echo "🔗 プロジェクトリンク確認中..."
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  プロジェクトがリンクされていません"
    echo "リンク中..."
    supabase link --project-ref "$PROJECT_REF"
fi

echo "✅ プロジェクトリンク済み"
echo ""

# 各Functionをデプロイ
SUCCESS_COUNT=0
FAIL_COUNT=0
FAILED_FUNCTIONS=()

echo "📦 Edge Functions デプロイ中..."
echo "総数: ${#FUNCTIONS[@]} functions"
echo ""

for func in "${FUNCTIONS[@]}"; do
    echo "----------------------------------------"
    echo "📤 デプロイ中: $func"

    if supabase functions deploy "$func" --no-verify-jwt; then
        echo "✅ $func デプロイ成功"
        ((SUCCESS_COUNT++))
    else
        echo "❌ $func デプロイ失敗"
        ((FAIL_COUNT++))
        FAILED_FUNCTIONS+=("$func")
    fi
    echo ""
done

echo "========================================"
echo "📊 デプロイ結果"
echo "========================================"
echo "✅ 成功: $SUCCESS_COUNT / ${#FUNCTIONS[@]}"
echo "❌ 失敗: $FAIL_COUNT / ${#FUNCTIONS[@]}"
echo ""

if [ $FAIL_COUNT -gt 0 ]; then
    echo "失敗したFunctions:"
    for func in "${FAILED_FUNCTIONS[@]}"; do
        echo "  - $func"
    done
    echo ""
    echo "⚠️  失敗したFunctionsを個別にデプロイしてください:"
    for func in "${FAILED_FUNCTIONS[@]}"; do
        echo "  supabase functions deploy $func --no-verify-jwt"
    done
    exit 1
else
    echo "🎉 すべてのEdge Functionsのデプロイが完了しました！"
    echo ""
    echo "次のステップ:"
    echo "1. Supabaseダッシュボードで環境変数を設定"
    echo "   https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
    echo ""
    echo "2. 必要な環境変数:"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo "   - TWITTER_API_KEY"
    echo "   - TWITTER_API_SECRET"
    echo "   - TWITTER_BEARER_TOKEN"
    echo ""
    echo "3. デプロイ済みFunctions確認:"
    echo "   supabase functions list"
fi
