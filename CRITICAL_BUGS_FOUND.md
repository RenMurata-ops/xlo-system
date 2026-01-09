# 🚨 緊急: E2Eテスト不足により発見された重大なバグ

**発見日**: 2026-01-09
**調査トリガー**: ユーザーからの「機能面でのエラー、スキーマのズレ、名称間違いがE2Eでテストされているか？」という質問
**結論**: 現在のE2Eテストは**表面的すぎて、実際の機能を全くテストしていない**

---

## エグゼクティブサマリー

**現在のE2Eテスト (30 tests) の問題点:**
- ✅ 認証リダイレクトのみテスト
- ❌ **実際の機能フロー (フォーム送信、データ作成、API呼び出し) は一切テストされていない**
- ❌ **ページに "Application error" が含まれないかだけチェック** → 極めて浅いテスト

**発見された重大なバグ:**
- 🔴 **CRITICAL**: 投稿機能が完全に壊れている (存在しないAPI呼び出し)
- 🔴 **CRITICAL**: データベースビューが全て失敗する (カラム名不一致)
- 🟡 **HIGH**: 複数の機能でスキーマ不整合

**影響範囲:**
- 投稿機能: **完全に動作不可**
- ダッシュボード統計: **データ取得失敗の可能性**
- スパムアカウント管理: **データ不整合**
- エンゲージメント分析: **クエリ失敗**

---

## 🔴 CRITICAL: 即座に修正が必要

### Bug #1: 投稿機能が完全に壊れている

**場所**: `app/posts/page.tsx:149`

**問題**:
```typescript
// 現在のコード (間違い)
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bright-service`,
  //                                                        ^^^^^^^^^^^^
  //                                                        存在しないEdge Function
  { ... }
);
```

**実際のEdge Function名**: `execute-single-post`

**影響**:
- 「今すぐ投稿」ボタンをクリック → **404 Not Found**
- ユーザーは投稿を一切実行できない
- エラーメッセージも表示されない (適切なエラーハンドリング不足)

**修正方法**:
```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/execute-single-post`,
  { ... }
);
```

**E2Eテストで検出できなかった理由**:
- 現在のテストは「ページが表示されるか」だけチェック
- **実際に投稿ボタンをクリックしてAPI呼び出しをテストしていない**

---

### Bug #2: データベースビュー `v_account_overview` が失敗

**場所**: `supabase/migrations/20251119000007_database_enhancements.sql:195-210`

**問題**:
```sql
CREATE OR REPLACE VIEW v_account_overview AS
SELECT
  ma.id,
  ma.user_id,
  'main' as account_type,
  ma.account_handle as handle,  -- ❌ account_handle は存在しない
  ma.account_name as name,       -- ❌ account_name は存在しない
  ma.follower_count,
  ma.following_count,
  at.access_token IS NOT NULL as is_connected
FROM main_accounts ma
LEFT JOIN account_tokens at ON at.account_id = ma.id
```

**実際のカラム名**: `handle`, `name` (マイグレーション 20251119000012 で旧カラム削除済み)

**影響**:
- ダッシュボードでアカウント一覧表示が失敗
- `SELECT * FROM v_account_overview` → **エラー: column "account_handle" does not exist**

**修正方法**:
```sql
CREATE OR REPLACE VIEW v_account_overview AS
SELECT
  ma.id,
  ma.user_id,
  'main' as account_type,
  ma.handle,          -- ✅ 正しいカラム名
  ma.name,            -- ✅ 正しいカラム名
  ma.follower_count,
  ma.following_count,
  at.access_token IS NOT NULL as is_connected
FROM main_accounts ma
LEFT JOIN account_tokens at ON at.account_id = ma.id
```

---

### Bug #3: ビュー `v_post_performance` が失敗

**場所**: `supabase/migrations/20251119000007_database_enhancements.sql:259-286`

**問題**:
```sql
CREATE OR REPLACE VIEW v_post_performance AS
SELECT
  p.id,
  p.content,
  p.status,
  p.posted_at,
  p.like_count,        -- ❌ posts テーブルに存在しない
  p.retweet_count,     -- ❌ 存在しない
  p.reply_count,       -- ❌ 存在しない
  p.quote_count,       -- ❌ 存在しない
  p.impression_count,  -- ❌ 存在しない
  p.engagement_rate
FROM posts p
```

**実際の posts テーブル**:
- `engagement_count` のみ存在 (初期スキーマ 20251110_initial_schema.sql)
- 個別のエンゲージメントカラムは実装されていない

**影響**:
- 投稿パフォーマンス分析機能が完全に失敗
- ダッシュボードの統計表示がエラー

**修正方法 (オプション1: ビューを削除)**:
```sql
DROP VIEW IF EXISTS v_post_performance;
```

**修正方法 (オプション2: 実際のカラムのみ使用)**:
```sql
CREATE OR REPLACE VIEW v_post_performance AS
SELECT
  p.id,
  p.content,
  p.status,
  p.posted_at,
  p.engagement_count,  -- ✅ 実際に存在するカラム
  p.created_at,
  p.updated_at
FROM posts p
WHERE p.status = 'posted';
```

---

### Bug #4: ビュー `v_dashboard_summary` が失敗

**場所**: `supabase/migrations/20251119000007_database_enhancements.sql:289-307`

**問題**:
```sql
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  u.id as user_id,
  (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'scheduled') as scheduled_posts,
  (SELECT COUNT(*) FROM follow_relationships WHERE user_id = u.id AND status = 'pending') as pending_unfollows,
  --                        ^^^^^^^^^^^^^^^^^^^^^^^
  --                        存在しないテーブル
  (SELECT COUNT(*) FROM cta_executions ce
   JOIN cta_triggers ct ON ct.id = ce.trigger_id
   WHERE ct.user_id = u.id AND ce.status = 'scheduled') as pending_cta
  --     ^^^^^^^^^^^^^^ & ^^^^^^^^^^^
  --     存在しないテーブル
FROM auth.users u;
```

**実際のデータベース**:
- `follow_relationships` テーブルは存在しない
- `cta_executions`, `cta_triggers` テーブルも存在しない

**影響**:
- ダッシュボードのサマリー表示が完全に失敗
- `SELECT * FROM v_dashboard_summary` → **エラー: relation "follow_relationships" does not exist**

**修正方法**:
```sql
-- 存在しないテーブル参照を削除
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  u.id as user_id,
  (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'scheduled') as scheduled_posts,
  (SELECT COUNT(*) FROM account_tokens WHERE user_id = u.id AND is_active = true) as active_accounts,
  (SELECT COUNT(*) FROM loops WHERE user_id = u.id AND is_active = true) as active_loops
FROM auth.users u;
```

---

## 🟡 HIGH: 早急に修正すべき問題

### Bug #5: `proxies.proxy_name` カラムが存在しない

**場所**: `components/accounts/SpamAccountForm.tsx:106`

**問題**:
```typescript
const { data: proxies } = await supabase
  .from('proxies')
  .select('id, proxy_name')  // ❌ proxy_name カラムは存在しない
  .eq('user_id', user.id);
```

**実際の proxies テーブル** (20251110_initial_schema.sql):
```sql
CREATE TABLE proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  proxy_type TEXT NOT NULL,
  proxy_url TEXT NOT NULL,
  proxy_port INTEGER,
  proxy_username TEXT,
  proxy_password TEXT,
  is_active BOOLEAN DEFAULT true,
  response_time_ms INTEGER,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**カラムリスト**: `proxy_type`, `proxy_url` など → **`proxy_name` は存在しない**

**影響**:
- スパムアカウント作成フォームでプロキシ選択ができない
- エラー: **column "proxy_name" does not exist**

**修正方法 (オプション1: マイグレーション追加)**:
```sql
-- 新しいマイグレーションファイル
ALTER TABLE proxies ADD COLUMN proxy_name TEXT;
UPDATE proxies SET proxy_name = proxy_url WHERE proxy_name IS NULL;
```

**修正方法 (オプション2: コード修正)**:
```typescript
const { data: proxies } = await supabase
  .from('proxies')
  .select('id, proxy_url, proxy_type')  // ✅ 実際に存在するカラム
  .eq('user_id', user.id);

// UIでは proxy_url を表示
```

---

### Bug #6: ビュー `v_rule_performance` でカラム名不一致

**場所**: `supabase/migrations/20251119000007_database_enhancements.sql:310-330`

**問題**:
```sql
SELECT
  aer.id,
  ma.account_handle,  -- ❌ 正しくは ma.handle
  aer.target_keywords,
  ...
FROM auto_engagement_rules aer
LEFT JOIN main_accounts ma ON ma.id = aer.main_account_id
```

**修正方法**:
```sql
SELECT
  aer.id,
  ma.handle,  -- ✅ 正しいカラム名
  aer.target_keywords,
  ...
FROM auto_engagement_rules aer
LEFT JOIN main_accounts ma ON ma.id = aer.main_account_id
```

---

## 📊 バグの根本原因分析

### なぜこれらのバグが本番に残っているのか？

#### 1. E2Eテストの質が低い

**現在のテスト内容**:
```typescript
// e2e/posts.spec.ts
test('posts page redirects to login when not authenticated', async ({ page }) => {
  await page.goto('/posts');
  await expect(page).toHaveURL(/\/auth\/login/);
  // ✅ これだけ。実際の投稿機能は一切テストしていない
});
```

**テストすべきだった内容**:
```typescript
test('user can create and execute a post', async ({ page }) => {
  // ログイン
  await authenticateUser(page);

  // 投稿ページに移動
  await page.goto('/posts');

  // フォーム入力
  await page.fill('textarea[name="content"]', 'Test post');
  await page.selectOption('select[name="account_id"]', '...');

  // 「今すぐ投稿」ボタンをクリック
  await page.click('button:has-text("今すぐ投稿")');

  // 成功メッセージを確認
  await expect(page.locator('text=投稿が完了しました')).toBeVisible();

  // ❌ この時点で 404 エラーが発生していたはず
});
```

#### 2. マイグレーションの実行順序問題

**問題のある変更履歴**:
```
20251110: handle, name で作成
20251118: account_handle, account_name に変更
20251119000007: ビュー作成 (account_handle, account_name を使用) ← ここで固定化
20251119000011: handle, name を再度追加
20251119000012: account_handle, account_name を削除 ← ビューが壊れる
```

**ビューが更新されなかった**: 20251119000007 で作成されたビューは、その後のマイグレーションで更新されていない

#### 3. 型チェックが不十分

**TypeScript型定義とデータベーススキーマが乖離**:
- 型定義ファイルが自動生成されていない
- 手動で型を定義している箇所で不整合が発生

#### 4. コードレビューでのチェック不足

- API エンドポイント名が間違っていても気づかれなかった
- データベースカラム名の変更がコード全体に反映されていない

---

## 🛠️ 修正アクションプラン

### Phase 1: 緊急バグ修正 (今すぐ実施)

#### 1-1. API呼び出しの修正
```bash
# app/posts/page.tsx を修正
```

#### 1-2. データベースビューの修正マイグレーション作成
```bash
# 新しいマイグレーションファイルを作成
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_fix_database_views.sql
```

```sql
-- v_account_overview の修正
DROP VIEW IF EXISTS v_account_overview;
CREATE VIEW v_account_overview AS
SELECT
  ma.id,
  ma.user_id,
  'main' as account_type,
  ma.handle,
  ma.name,
  ma.follower_count,
  ma.following_count,
  at.access_token IS NOT NULL as is_connected
FROM main_accounts ma
LEFT JOIN account_tokens at ON at.account_id = ma.id
UNION ALL
SELECT
  fa.id,
  fa.user_id,
  'follow' as account_type,
  fa.handle,
  fa.name,
  fa.follower_count,
  NULL as following_count,
  at.access_token IS NOT NULL as is_connected
FROM follow_accounts fa
LEFT JOIN account_tokens at ON at.account_id = fa.id
UNION ALL
SELECT
  sa.id,
  sa.user_id,
  'spam' as account_type,
  sa.handle,
  sa.name,
  NULL as follower_count,
  NULL as following_count,
  at.access_token IS NOT NULL as is_connected
FROM spam_accounts sa
LEFT JOIN account_tokens at ON at.account_id = sa.id;

-- v_post_performance の削除または簡略化
DROP VIEW IF EXISTS v_post_performance;
-- 必要に応じて再作成 (実際に存在するカラムのみ使用)

-- v_dashboard_summary の修正
DROP VIEW IF EXISTS v_dashboard_summary;
CREATE VIEW v_dashboard_summary AS
SELECT
  u.id as user_id,
  (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'scheduled') as scheduled_posts,
  (SELECT COUNT(*) FROM account_tokens WHERE user_id = u.id AND is_active = true) as active_accounts,
  (SELECT COUNT(*) FROM loops WHERE user_id = u.id AND is_active = true) as active_loops
FROM auth.users u;

-- v_rule_performance の修正
DROP VIEW IF EXISTS v_rule_performance;
CREATE VIEW v_rule_performance AS
SELECT
  aer.id,
  ma.handle,  -- 修正
  aer.target_keywords,
  aer.is_active,
  aer.created_at
FROM auto_engagement_rules aer
LEFT JOIN main_accounts ma ON ma.id = aer.main_account_id;
```

#### 1-3. proxy_name カラムの追加
```bash
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_add_proxy_name.sql
```

```sql
ALTER TABLE proxies ADD COLUMN IF NOT EXISTS proxy_name TEXT;
UPDATE proxies SET proxy_name = proxy_url WHERE proxy_name IS NULL;
```

### Phase 2: 包括的なE2Eテスト追加 (1週間)

#### 2-1. 認証ヘルパー作成
```typescript
// e2e/helpers/auth.ts
export async function authenticateUser(page: Page) {
  // テストユーザーでログイン
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'test-password');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}
```

#### 2-2. 投稿機能の完全なE2Eテスト
```typescript
// e2e/posts-full.spec.ts
test.describe('Posts - Full Flow', () => {
  test('user can create and execute a post immediately', async ({ page }) => {
    await authenticateUser(page);

    await page.goto('/posts');
    await page.fill('textarea[name="content"]', 'Test post from E2E');
    await page.selectOption('select[name="account_id"]', { index: 0 });

    // 「今すぐ投稿」ボタンをクリック
    const postButton = page.locator('button:has-text("今すぐ投稿")');
    await postButton.click();

    // API呼び出しを監視
    const response = await page.waitForResponse(
      response => response.url().includes('execute-single-post') && response.status() === 200
    );

    expect(response.ok()).toBe(true);

    // 成功メッセージ
    await expect(page.locator('text=投稿が完了しました')).toBeVisible({ timeout: 10000 });
  });

  test('user can schedule a post', async ({ page }) => {
    await authenticateUser(page);

    await page.goto('/posts');
    await page.fill('textarea[name="content"]', 'Scheduled post');
    await page.selectOption('select[name="account_id"]', { index: 0 });

    // 日時選択
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('input[type="datetime-local"]', tomorrow.toISOString().slice(0, 16));

    // 「スケジュール」ボタンをクリック
    await page.click('button:has-text("スケジュール")');

    // データベースに保存されたことを確認
    await expect(page.locator('text=スケジュールしました')).toBeVisible();
  });
});
```

#### 2-3. アカウント管理の完全なE2Eテスト
```typescript
// e2e/accounts-full.spec.ts
test.describe('Accounts - Full Flow', () => {
  test('user can add a new main account via OAuth', async ({ page, context }) => {
    await authenticateUser(page);

    await page.goto('/accounts/main');
    await page.click('button:has-text("アカウントを追加")');

    // Twitter App選択
    await page.selectOption('select[name="twitter_app_id"]', { index: 0 });
    await page.click('button:has-text("Twitter連携を開始")');

    // Twitter OAuth画面 (新しいページで開く)
    const [oauthPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('button:has-text("Twitter連携を開始")')
    ]);

    // OAuth完了後のリダイレクト
    await oauthPage.waitForURL(/\/accounts\/main\?connected=1/);

    // 成功メッセージ
    await expect(page.locator('text=アカウント連携が完了しました')).toBeVisible();
  });

  test('connected account appears in account list', async ({ page }) => {
    await authenticateUser(page);

    await page.goto('/accounts/main');

    // アカウントカードが表示される
    const accountCard = page.locator('[data-testid="account-card"]').first();
    await expect(accountCard).toBeVisible();

    // アカウント情報が正しく表示される
    await expect(accountCard.locator('text=@')).toBeVisible();  // handle
    await expect(accountCard.locator('text=フォロワー')).toBeVisible();
  });
});
```

#### 2-4. スキーマ整合性テスト
```typescript
// e2e/schema-validation.spec.ts
test.describe('Database Schema Validation', () => {
  test('all database views are queryable', async ({ page }) => {
    await authenticateUser(page);

    // Supabase clientを使ってビューをクエリ
    const views = [
      'v_account_overview',
      'v_dashboard_summary',
      'v_rule_performance'
    ];

    for (const view of views) {
      const response = await page.evaluate(async (viewName) => {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(/* ... */);
        const { data, error } = await supabase.from(viewName).select('*').limit(1);
        return { data, error };
      }, view);

      expect(response.error).toBeNull();
    }
  });
});
```

### Phase 3: CI/CDにスキーマバリデーション追加 (1週間)

```yaml
# .github/workflows/schema-validation.yml
name: Database Schema Validation

on:
  pull_request:
    paths:
      - 'supabase/migrations/**'
      - 'app/**/*.tsx'
      - 'components/**/*.tsx'

jobs:
  validate-schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Supabase CLIでローカルDBを起動
      - uses: supabase/setup-cli@v1
      - run: supabase start

      # 全マイグレーションを適用
      - run: supabase db reset

      # ビューがクエリ可能か確認
      - run: |
          supabase db execute "SELECT * FROM v_account_overview LIMIT 1;"
          supabase db execute "SELECT * FROM v_dashboard_summary LIMIT 1;"
          supabase db execute "SELECT * FROM v_rule_performance LIMIT 1;"

      # スキーマダンプを出力
      - run: supabase db dump -f schema.sql

      # 型定義を自動生成
      - run: supabase gen types typescript --local > types/database.types.ts

      # TypeScript型チェック
      - run: npm run typecheck
```

---

## 📈 今後の品質保証体制

### 1. プルリクエストチェックリスト強化

**必須項目に追加**:
- [ ] 新しいAPIエンドポイントは実際に存在するか確認済み
- [ ] データベースカラム名の変更は全てのコード・ビューに反映済み
- [ ] 新しいE2Eテストを追加済み (新機能の場合)
- [ ] 手動でフルフロー動作確認済み

### 2. 定期的なスキーマ監査

**月次タスク**:
- データベーススキーマダンプと型定義の比較
- 未使用カラムの特定
- ビューの再生成確認

### 3. E2Eテストカバレッジ目標

**現在**: 認証リダイレクトのみ (カバレッジ 5%)
**目標**: 全主要フローをカバー (カバレッジ 80%)

**追加すべきテストシナリオ**:
- [ ] 投稿作成・実行・スケジュール
- [ ] アカウント追加 (OAuth連携)
- [ ] ループ作成・実行
- [ ] エンゲージメントルール作成
- [ ] テンプレート作成・適用
- [ ] スパムアカウントCSVインポート
- [ ] プロキシ設定
- [ ] ダッシュボード統計表示

---

## ✅ チェックリスト: 本番デプロイ前に実施必須

### 緊急修正 (Phase 1)
- [ ] `app/posts/page.tsx` のAPI名を修正
- [ ] データベースビュー修正マイグレーション作成
- [ ] `proxy_name` カラム追加マイグレーション作成
- [ ] ローカル環境でマイグレーション実行・確認
- [ ] 全ページの手動動作確認

### E2Eテスト追加 (Phase 2)
- [ ] 認証ヘルパー作成
- [ ] 投稿機能の完全なE2Eテスト
- [ ] アカウント管理の完全なE2Eテスト
- [ ] スキーマ整合性テスト
- [ ] 全E2Eテストが成功することを確認

### CI/CD強化 (Phase 3)
- [ ] スキーマバリデーションワークフロー追加
- [ ] PRチェックリスト更新
- [ ] 型定義自動生成の組み込み

---

## 結論

**現状**: ❌ **本番環境デプロイ不可**

**理由**:
1. 投稿機能が完全に壊れている (Critical)
2. データベースビューが全て失敗する (Critical)
3. スパムアカウント機能でデータ不整合 (High)

**必要な対応**:
1. Phase 1の緊急修正を完了
2. 全機能の手動動作確認
3. Phase 2のE2Eテスト追加
4. 再度全テスト実行・合格確認

**Phase 1完了後**: 🟡 **条件付きでデプロイ可能** (重大バグは修正済み)
**Phase 2完了後**: ✅ **安心してデプロイ可能** (品質保証体制が整う)

---

*このレポートは2026-01-09に作成されました。発見されたバグは即座に修正が必要です。*
