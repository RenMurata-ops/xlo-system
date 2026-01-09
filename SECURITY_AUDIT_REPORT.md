# セキュリティ監査レポート

**実施日**: 2026-01-09
**対象システム**: XLO System
**監査者**: Claude Code
**重大度レベル**: 🔴 高 | 🟡 中 | 🟢 低

---

## エグゼクティブサマリー

XLO Systemの包括的なセキュリティ監査を実施しました。依存関係の脆弱性は修正済みですが、**2つの重大なセキュリティ問題**と複数の中程度のリスクが発見されました。本番環境デプロイ前に、特に高リスク項目の修正が必須です。

### 監査結果サマリー

- ✅ **修正済み**: 依存関係の脆弱性 (React Router XSS)
- 🔴 **Critical (2件)**: Edge Functions認証欠如、環境変数管理
- 🟡 **Medium (3件)**: RLS バイパス、CORS設定、エラーメッセージ詳細度
- 🟢 **Good (5件)**: Next.js認証、XSS対策、SQL Injection対策、Git管理、データ整合性制約

---

## 🔴 CRITICAL: 重大な脆弱性

### 1. Edge Functions の認証欠如 (CRITICAL)

**問題の詳細**:
全てのSupabase Edge Functionsで `verify_jwt = false` が設定されており、認証なしで誰でも呼び出し可能です。

**影響範囲**:
```toml
[functions.refresh-tokens]
verify_jwt = false
[functions.execute-auto-engagement]
verify_jwt = false
[functions.execute-scheduled-posts]
verify_jwt = false
[functions.twitter-oauth-start]
verify_jwt = false
```

**攻撃シナリオ**:
1. 攻撃者が `refresh-tokens` を呼び出し → 全トークンを更新/無効化
2. 攻撃者が `execute-scheduled-posts` を呼び出し → 不正な投稿実行
3. 攻撃者が `dispatch-dms` を呼び出し → スパムDM送信
4. 全ての関数がSERVICE_ROLE_KEYを使用 → RLSバイパス、全データアクセス可能

**影響度**: 🔴 **CRITICAL**
**CVSSスコア推定**: 9.8 (Critical)

**修正方法**:

#### オプション1: JWT認証を有効化 (推奨)
```toml
# supabase/config.toml

# ユーザー向けエンドポイント (JWT認証必須)
[functions.twitter-oauth-start]
verify_jwt = true

# 内部エンドポイント (JWT認証必須 + 追加チェック)
[functions.refresh-tokens]
verify_jwt = true

[functions.execute-auto-engagement]
verify_jwt = true
```

関数コード内で追加の認証チェック:
```typescript
// refresh-tokens/index.ts に追加
serve(async (req) => {
  // JWT認証チェック (verify_jwt = true で自動検証済み)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401
    });
  }

  // Supabaseクライアントで追加検証
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401
    });
  }

  // 管理者チェック (必要に応じて)
  if (!user.email || user.email !== Deno.env.get('ADMIN_EMAIL')) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403
    });
  }

  // ... 既存のロジック
});
```

#### オプション2: Cron専用エンドポイントとして保護
バックグラウンドジョブ専用の場合:
- Supabase Dashboard > Edge Functions > 各関数 > Settingsで「HTTP」を無効化
- Cronジョブからのみ実行可能に設定
- または、IPホワイトリスト/VPC内部からのみアクセス許可

**優先度**: 🚨 **即座に修正が必要**

---

### 2. 環境変数の不適切な管理 (CRITICAL)

**問題の詳細**:
- `.env.local` に本番環境の機密情報が含まれている
  - `SUPABASE_SERVICE_ROLE_KEY` (フルアクセス権限)
  - `DATABASE_URL` (パスワード含む)
  - 本番Supabase URLとANON_KEY

**発見された機密情報**:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:XLO20251110%40@db.swyiwqzlmozlqircyyzr.supabase.co:5432/postgres
```

**リスク**:
1. ローカル環境が侵害された場合、本番DBへの完全アクセスを許す
2. 開発者の端末盗難/紛失時に即座にセキュリティ侵害
3. サービスロールキーで全RLSをバイパス可能

**修正方法**:

#### 即座の対応 (今すぐ実施):
```bash
# 1. .env.local を削除
rm .env.local

# 2. Supabase Dashboardで全キーをローテーション
# - Project Settings > API > Reset service_role key
# - Database Settings > Reset database password

# 3. 環境変数は環境変数管理サービスで管理
# - Vercel: Environment Variables
# - GitHub Actions: Secrets
# - ローカル: .env.local (gitignore済み、本番環境とは別のキー)
```

#### 長期的な対応:
```bash
# .env.local.example を作成 (実際の値は含めない)
cat > .env.local.example << 'EOF'
# Supabase Configuration (開発環境用)
NEXT_PUBLIC_SUPABASE_URL=your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_dev_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_dev_service_role_key

# Database (開発環境用)
DATABASE_URL=your_dev_database_url

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAIL=your_admin_email
EOF
```

**優先度**: 🚨 **即座にキーローテーション実施**

---

## 🟡 MEDIUM: 中程度のリスク

### 3. SERVICE_ROLE_KEYによるRLSバイパス

**問題の詳細**:
全Edge FunctionsがSERVICE_ROLE_KEYを使用しており、Row Level Security (RLS) を完全にバイパスしています。

**影響**:
- RLSポリシーは設定されているが、Edge Functions経由では無効
- ユーザーAがユーザーBのデータを操作可能 (関数が認証されていれば)

**修正方法**:
```typescript
// ユーザー固有の操作はANON_KEYを使用
const supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY, // SERVICE_ROLE_KEYではなく
  {
    global: {
      headers: {
        Authorization: `Bearer ${userToken}` // リクエストから取得したユーザートークン
      }
    }
  }
);

// バックグラウンドジョブのみSERVICE_ROLE_KEYを使用
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
```

**優先度**: 🟡 高 (認証実装後に修正)

---

### 4. CORS設定の過度な許可

**問題の詳細**:
Edge FunctionsのCORS設定を確認する必要があります。

**確認項目**:
```typescript
// supabase/functions/_shared/cors.ts を確認
export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', // ❌ 全オリジン許可は危険
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
```

**推奨設定**:
```typescript
export function getCorsHeaders(origin?: string) {
  const allowedOrigins = [
    'https://your-production-domain.com',
    'http://localhost:3000', // 開発環境のみ
  ];

  const allowOrigin = allowedOrigins.includes(origin || '')
    ? origin
    : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
```

**優先度**: 🟡 中

---

### 5. エラーメッセージの詳細度

**問題の詳細**:
一部のエラーメッセージで内部実装詳細が漏洩する可能性があります。

**例**:
```typescript
// refresh-tokens/index.ts:50
logger.error('Token refresh failed', {
  x_username: tokenRecord.x_username,
  status: response.status,
  error: errorText, // ❌ Twitter APIの詳細エラーをそのまま返す
});
```

**修正方法**:
```typescript
// 本番環境では汎用的なエラーメッセージを返す
const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';

return new Response(
  JSON.stringify({
    success: false,
    error: isDevelopment
      ? `HTTP ${response.status}: ${errorText}` // 開発環境: 詳細
      : 'Token refresh failed', // 本番環境: 汎用的
  }),
  { status: 500 }
);
```

**優先度**: 🟡 中

---

## 🟢 GOOD: 良好なセキュリティ対策

### ✅ 1. 依存関係の脆弱性管理

**状態**: ✅ 修正済み

- React Router XSS脆弱性 (GHSA-2w69-qvjg-hvjx) を `npm audit fix` で修正
- 現在の脆弱性: **0件**

```bash
$ npm audit
found 0 vulnerabilities
```

**推奨**: 定期的な `npm audit` 実行をCI/CDに組み込む

---

### ✅ 2. Next.js認証ミドルウェア

**状態**: ✅ 実装済み

`middleware.ts` で14の保護ルートに対してサーバーサイド認証を実装:

```typescript
// 未認証ユーザーは自動的に /auth/login にリダイレクト
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/accounts/:path*',
    '/posts/:path*',
    // ... 全14ルート
  ],
};
```

**セキュリティポイント**:
- ✅ サーバーサイド認証 (クライアント側のバイパス不可)
- ✅ セッショントークン検証
- ✅ リダイレクト時に元のパスを保持

---

### ✅ 3. XSS対策

**状態**: ✅ 良好

**確認結果**:
```bash
$ grep -r "dangerouslySetInnerHTML" .
# No files found ✅

$ grep -r "eval(" .
# No files found ✅

$ grep -r "innerHTML\|outerHTML" .
# No files found ✅
```

**使用フレームワーク**:
- React (自動エスケープ)
- Next.js (XSS保護機能内蔵)

---

### ✅ 4. SQL Injection対策

**状態**: ✅ 良好

**確認結果**:
- ❌ Raw SQL クエリなし
- ✅ Supabase クライアント (パラメータ化クエリ) のみ使用
- ✅ ORMレベルでのSQLインジェクション対策

```typescript
// ✅ 安全なクエリ例
await supabase
  .from('account_tokens')
  .select('*')
  .eq('user_id', userId); // パラメータ化済み
```

---

### ✅ 5. Git管理

**状態**: ✅ 良好

**確認結果**:
- ✅ `.env` ファイルは `.gitignore` に含まれている
- ✅ 実際の `.env.local` はGit履歴に含まれていない
- ✅ `.env.example` のみコミット済み (機密情報なし)

```bash
$ git ls-files | grep -E "\.env"
.env.example
supabase/functions/.env.example
```

---

### ✅ 6. データ整合性制約

**状態**: ✅ 実装済み

**Migration `20251217_add_safety_constraints.sql` で実装**:
- ✅ CHECK制約 (非負数、範囲検証)
- ✅ 外部キー制約 (孤立レコード防止)
- ✅ トリガー (削除保護、自動クリーンアップ)
- ✅ レート制限チェック関数

```sql
ALTER TABLE account_tokens
  ADD CONSTRAINT check_followers_count_non_negative
  CHECK (followers_count >= 0);
```

---

## 📋 修正アクションプラン

### Phase 1: 緊急対応 (24時間以内)

1. **環境変数のローテーション** 🚨
   ```bash
   # Supabase Dashboard > Project Settings > API
   # - Service Role Keyをリセット
   # - Database Passwordをリセット
   # - .env.local を削除して再作成 (開発用キーのみ)
   ```

2. **Edge Functions認証の有効化** 🚨
   ```toml
   # supabase/config.toml を更新
   [functions.refresh-tokens]
   verify_jwt = true

   [functions.execute-auto-engagement]
   verify_jwt = true

   # ... 全関数に適用
   ```

3. **関数内での認証チェック追加** 🚨
   ```typescript
   // 各Edge Functionの先頭に追加
   const authHeader = req.headers.get('Authorization');
   if (!authHeader) {
     return new Response('Unauthorized', { status: 401 });
   }
   ```

### Phase 2: 高優先度対応 (1週間以内)

4. **RLSバイパスの修正**
   - ユーザー操作はANON_KEY + ユーザートークンを使用
   - バックグラウンドジョブのみSERVICE_ROLE_KEY使用

5. **CORS設定の厳格化**
   - 許可オリジンをホワイトリスト化
   - 本番ドメインのみ許可

6. **エラーメッセージの汎用化**
   - 環境変数で開発/本番を切り替え
   - 本番環境では詳細エラーを隠蔽

### Phase 3: 継続的改善

7. **セキュリティテストの自動化**
   ```yaml
   # .github/workflows/security.yml
   name: Security Audit
   on: [push, pull_request]
   jobs:
     audit:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - run: npm audit
         - run: npm run test:security # 追加予定
   ```

8. **ペネトレーションテストの実施**
   - OWASP ZAPによる自動スキャン
   - 手動ペネトレーションテスト

9. **セキュリティドキュメントの作成**
   - セキュリティポリシー文書
   - インシデントレスポンス手順
   - キーローテーション手順

---

## 🎯 推奨事項

### 短期 (1ヶ月以内)

1. **認証基盤の強化**
   - Multi-Factor Authentication (MFA) の実装
   - セッションタイムアウトの設定
   - 不正ログイン検知

2. **監視とログ**
   - Edge Function呼び出しの監視
   - 異常検知アラート
   - セキュリティログの集約

3. **定期セキュリティレビュー**
   - 週次: `npm audit`
   - 月次: 依存関係アップデート
   - 四半期: 全体セキュリティ監査

### 長期 (3ヶ月以内)

1. **Zero Trust アーキテクチャ**
   - 全リクエストで認証検証
   - 最小権限の原則
   - マイクロセグメンテーション

2. **コンプライアンス対応**
   - GDPR対応 (EU圏ユーザーがいる場合)
   - SOC 2 Type II準拠 (大企業向け)
   - ISO 27001認証取得検討

3. **災害復旧計画**
   - バックアップ戦略
   - 復旧手順書
   - 定期的な復旧訓練

---

## 📊 リスク評価マトリックス

| 脆弱性 | 影響度 | 発生確率 | リスクレベル | 優先度 |
|--------|--------|----------|--------------|--------|
| Edge Functions認証欠如 | 🔴 Critical | 高 | 🔴 Critical | P0 |
| 環境変数管理不備 | 🔴 High | 中 | 🔴 High | P0 |
| RLSバイパス | 🟡 Medium | 中 | 🟡 Medium | P1 |
| CORS過度な許可 | 🟡 Medium | 低 | 🟡 Low | P2 |
| エラー詳細漏洩 | 🟢 Low | 低 | 🟢 Low | P2 |

---

## ✅ 結論

XLO Systemは基本的なセキュリティ対策は実装されていますが、**Edge Functions の認証欠如**という重大な脆弱性が存在します。本番環境へのデプロイ前に、必ずPhase 1の緊急対応を完了してください。

**本番デプロイ可否**: ❌ **Phase 1修正後に可**

---

**次のステップ**:
1. 本レポートを開発チームと共有
2. Phase 1の緊急対応を実施
3. 修正後に再度セキュリティ監査を実施
4. 継続的なセキュリティ監視体制を構築

---

*本レポートは2026-01-09時点の情報に基づいています。システムの変更に応じて定期的に更新してください。*
