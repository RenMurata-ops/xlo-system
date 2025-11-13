# Supabase Edge Functions GUI デプロイガイド

## 推奨方法: GitHub連携で自動デプロイ（最速・最適）

Supabaseダッシュボードは直接GitHubリポジトリと連携してEdge Functionsを自動デプロイできます。

### ステップ1: GitHubリポジトリとSupabaseを連携

1. **Supabaseダッシュボードにアクセス**
   - https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr

2. **Settings → Integrations**
   - 左サイドバーから「Settings」をクリック
   - 「Integrations」タブを選択

3. **GitHub連携**
   - 「GitHub」セクションを探す
   - 「Connect」または「Install GitHub Integration」をクリック
   - GitHubの認証画面が開く
   - リポジトリ `RenMurata-ops/xlo-system` へのアクセスを許可

4. **ブランチ選択**
   - デプロイするブランチを選択: `claude/twitter-automation-system-dev-011CV3mRd9bjC5anRNPrW5da`
   - 「Connect」をクリック

5. **自動デプロイ**
   - 連携完了後、SupabaseがリポジトリのEdge Functionsを自動検出
   - `supabase/functions/` ディレクトリ内の全Functionsが自動デプロイされる

### ✅ メリット
- 13個のFunctionすべてが一度にデプロイされる
- Git pushで自動更新
- コピペ不要
- エラーが少ない

---

## 代替方法: 手動でコードを貼り付け（非推奨）

GitHub連携ができない場合、各FunctionをGUIから手動作成できます。

⚠️ **注意**: 13個のFunctionがあり、最大のFunctionは500行以上あります。時間がかかりますが、以下の手順で可能です。

### 手動デプロイ手順

#### ステップ1: Edge Functions ページにアクセス

1. https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/functions にアクセス
2. 右上の「Create function」ボタンをクリック

#### ステップ2: 各Functionを作成

以下の13個のFunctionを1つずつ作成します。

---

### 🔑 優先度高（必須）

#### 1. twitter-oauth-start

**Function name**: `twitter-oauth-start`

**Code**:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// PKCE helper functions
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Generate PKCE values
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Save session to database
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    const { error: sessionError } = await supabase
      .from('oauth_sessions')
      .upsert({
        user_id: user.id,
        state,
        code_verifier: codeVerifier,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Session save error:', sessionError);
      throw new Error('Failed to save OAuth session');
    }

    // Build Twitter authorization URL
    const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID')!;
    const twitterRedirectUri = Deno.env.get('TWITTER_REDIRECT_URI')!;
    const scope = 'tweet.read tweet.write users.read offline.access';

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', twitterClientId);
    authUrl.searchParams.set('redirect_uri', twitterRedirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return new Response(
      JSON.stringify({
        authUrl: authUrl.toString(),
        state,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
```

**Verify JWT**: ❌ OFF（チェックを外す）

「Create function」をクリック

---

#### 2. twitter-oauth-callback-v2

**Function name**: `twitter-oauth-callback-v2`

**Code**: `/home/user/xlo-system/supabase/functions/twitter-oauth-callback-v2/index.ts` の全内容をコピペ

**Verify JWT**: ❌ OFF

---

#### 3. validate-and-refresh-tokens

**Function name**: `validate-and-refresh-tokens`

**Code**: `/home/user/xlo-system/supabase/functions/validate-and-refresh-tokens/index.ts` の全内容をコピペ

**Verify JWT**: ❌ OFF

---

### 📝 残りのFunctions（10個）

同様の手順で以下のFunctionsも作成:

4. **auto-token-refresh** - 自動トークンリフレッシュ
5. **comprehensive-token-refresh** - 包括的トークン更新
6. **refresh-expired-tokens** - 期限切れトークン更新
7. **execute-auto-engagement** - 自動エンゲージメント実行（最大529行）
8. **auto-unfollow-scheduler** - 自動アンフォロースケジューラー
9. **execute-bulk-posts** - 一括投稿実行
10. **execute-loop** - ループ実行
11. **schedule-loop-execution** - ループスケジューリング
12. **twitter-api-proxy** - Twitter APIプロキシ

各Functionのコードは `/home/user/xlo-system/supabase/functions/<function-name>/index.ts` にあります。

---

## 方法3: ローカルでZIP作成してアップロード

### ステップ1: Functionsを1つのファイルにまとめる

ローカルマシンで実行:

```bash
cd /home/user/xlo-system

# 各FunctionをZIPにまとめる
cd supabase/functions
for dir in */; do
  functionName="${dir%/}"
  echo "Zipping $functionName..."
  cd "$functionName"
  zip -r "../${functionName}.zip" .
  cd ..
done
```

### ステップ2: Supabase CLIなしでデプロイ

残念ながら、Supabase DashboardにはZIPアップロード機能がありません。

---

## 📊 各方法の比較

| 方法 | 所要時間 | 難易度 | エラーリスク | 推奨度 |
|------|---------|--------|------------|--------|
| **GitHub連携** | 5分 | ⭐️ 簡単 | ⭐️ 低 | ⭐️⭐️⭐️⭐️⭐️ |
| **手動コピペ** | 60分+ | ⭐️⭐️⭐️⭐️ 困難 | ⭐️⭐️⭐️⭐️ 高 | ⭐️ 非推奨 |
| **CLI使用** | 10分 | ⭐️⭐️ 普通 | ⭐️⭐️ 中 | ⭐️⭐️⭐️⭐️ |

---

## 🎯 最終推奨

### オプションA: GitHub連携（最推奨）

1. https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/settings/integrations
2. GitHubと連携
3. リポジトリ `RenMurata-ops/xlo-system` を選択
4. ブランチ `claude/twitter-automation-system-dev-011CV3mRd9bjC5anRNPrW5da` を選択
5. 自動デプロイ開始

これで13個すべてのFunctionが一度にデプロイされます。

### オプションB: 最重要3つだけ手動デプロイ

時間がない場合、以下の3つだけ手動でデプロイ:
1. `twitter-oauth-start`
2. `twitter-oauth-callback-v2`
3. `validate-and-refresh-tokens`

これでOAuth認証とトークン管理が動作します。残りは後でデプロイ可能。

---

## 環境変数設定（重要）

デプロイ後、必ず環境変数を設定:

https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/settings/functions

「Secrets」タブで追加:

```
SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
SUPABASE_ANON_KEY=（README参照）
SUPABASE_SERVICE_ROLE_KEY=（README参照）
TWITTER_CLIENT_ID=（Twitter Developer Portal）
TWITTER_CLIENT_SECRET=（Twitter Developer Portal）
TWITTER_REDIRECT_URI=（Vercel URLに合わせる）
APP_URL=https://xlo-system-nygx6oglc-sakamoto334422-gmailcoms-projects.vercel.app
```

---

## トラブルシューティング

### GitHub連携が見つからない場合

Settings → Integrations で「GitHub」が表示されない場合:
- Supabaseプロジェクトのプランを確認（GitHub連携はPro以上で利用可能）
- 代わりに手動デプロイまたはCLI使用

### コピペでエラーが出る場合

- コード内の環境変数が正しく設定されているか確認
- Deno importのバージョンが一致しているか確認
- CORS設定が正しいか確認

---

どの方法で進めますか？
