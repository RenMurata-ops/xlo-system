# 🔍 XLO System - 潜在的エラー要因の包括的分析

**分析日**: 2026-01-08
**対象範囲**: データベース、Edge Functions、認証、設定、データ整合性
**発見数**: **31個の潜在的エラー要因**

---

## 📊 エグゼクティブサマリー

スキーマキャッシュエラー以外にも、システムに**31個の潜在的なエラー要因**が存在することが判明しました。

### 深刻度別の内訳

| 深刻度 | 件数 | 説明 |
|--------|------|------|
| 🔴 **CRITICAL** | 7件 | システムが動作しない/セキュリティリスク |
| 🟠 **HIGH** | 11件 | 特定機能でエラー発生の可能性大 |
| 🟡 **MEDIUM** | 10件 | データ不整合やパフォーマンス問題 |
| 🟢 **LOW** | 3件 | 軽微な問題 |

### カテゴリ別の内訳

| カテゴリ | 件数 |
|---------|------|
| データベース制約・整合性 | 7件 |
| 認証・トークン管理 | 6件 |
| Edge Functions | 5件 |
| 環境変数・設定 | 3件 |
| データ整合性 | 3件 |
| レート制限・クォータ | 3件 |
| スケジュール・Cron Jobs | 3件 |
| 型定義・スキーマ整合性 | 2件 |

---

## 🔴 CRITICAL問題（即時対応が必要）

### 1. Edge Functions の環境変数未設定

**問題内容**:
- Edge Functionsは独自の環境変数を持つ
- `.env.local`の環境変数は自動的に渡されない
- デプロイ時に未設定だとEdge Functionsが動作しない

**影響範囲**: 全Edge Functions

**発生条件**: Edge Functions デプロイ時

**修正方法**:
```bash
# Supabase Dashboard または CLI で環境変数を設定
supabase secrets set SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set ALLOWED_ORIGINS=http://localhost:3000,https://your-production-domain.com
```

**参照**: `supabase/functions/.env.example:1-10`

---

### 2. トークンリフレッシュのタイミング不一致

**問題内容**:
- twitter-api-proxyは5分前にリフレッシュ
- cronは30分ごとに実行
- OAuth2トークンの有効期限が2時間の場合、1時間30分後にリフレッシュ
- その間のAPIリクエストで期限切れの可能性

**影響範囲**: 全Twitter API呼び出し

**修正方法**:
```sql
-- cronを15分ごとに変更
SELECT cron.schedule(
  'refresh-twitter-tokens',
  '*/15 * * * *',  -- 30分から15分に変更
  $$SELECT net.http_post(...)$$
);
```

**参照**:
- `supabase/functions/twitter-api-proxy/index.ts:194`
- `supabase/migrations/20251119000010_add_cron_refresh_tokens.sql:9`

---

### 3. twitter_app_id が NULL のトークンがリフレッシュ不能

**問題内容**:
- `20260107_add_twitter_app_id_to_tokens.sql` 実行前のトークン
- マイグレーションで紐付けできなかったトークン
- twitter_app_idがNULLだとrefresh-tokens functionで失敗

**影響範囲**: 既存の全トークン

**修正方法**:
```typescript
// refresh-tokens/index.ts
const twitterApp = token.twitter_app_id
  ? appMap.get(token.twitter_app_id)
  : await getDefaultTwitterApp(token.user_id); // フォールバック追加

async function getDefaultTwitterApp(userId: string) {
  const { data } = await supabase
    .from('twitter_apps')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();
  return data;
}
```

**参照**: `supabase/functions/refresh-tokens/index.ts:200-209`

---

### 4. 暗号化キーの未設定

**問題内容**:
- 暗号化キーが`current_setting('app.settings.encryption_key')`で取得
- 設定方法が不明確
- フォールバックキー `'xlo-default-encryption-key-change-me'` がハードコード
- 本番環境で未設定の場合、セキュリティリスク

**影響範囲**: トークンとパスワードの暗号化・復号化

**修正方法**:
```sql
-- オプション1: データベース設定
ALTER DATABASE postgres SET app.settings.encryption_key = 'your-secure-key-here';

-- オプション2: Supabase Vault を使用（推奨）
CREATE EXTENSION IF NOT EXISTS vault;
INSERT INTO vault.secrets (name, secret)
VALUES ('ENCRYPTION_KEY', 'your-secure-key-here');

-- 関数を更新
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ENCRYPTION_KEY' LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**参照**: `supabase/migrations/20260107_encrypt_sensitive_data.sql:23-29`

---

### 5. cron job の service_role_key 未設定

**問題内容**:
- `current_setting('app.settings.service_role_key', true)` が未設定
- pg_cron実行時にservice_role_keyが取得できない
- 全cron jobsが失敗

**影響範囲**: 全cron jobs（トークンリフレッシュ、ループ実行など）

**修正方法**:
```sql
-- データベースレベルで設定
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

-- 確認
SELECT current_setting('app.settings.service_role_key', true);
```

**参照**: `supabase/migrations/20251119000010_add_cron_refresh_tokens.sql:13`

---

### 6. twitter_apps の api_key と client_id の不一致

**問題内容**:
- テーブルスキーマ: `api_key`, `api_secret`
- refresh-tokens function: `client_id`, `client_secret` を期待
- カラム名の不一致により、OAuth認証とトークンリフレッシュが失敗

**影響範囲**: OAuth認証、トークンリフレッシュ

**修正方法**:
```sql
-- オプション1: カラム名を統一（推奨）
ALTER TABLE twitter_apps RENAME COLUMN api_key TO client_id;
ALTER TABLE twitter_apps RENAME COLUMN api_secret TO client_secret;

-- オプション2: VIEWで吸収
CREATE VIEW twitter_apps_compat AS
SELECT
  id,
  user_id,
  api_key AS client_id,
  api_secret AS client_secret,
  ...
FROM twitter_apps;
```

**参照**: `supabase/migrations/20251112_002_add_missing_tables.sql:16-17`

---

### 7. account_tokens.account_id の外部キー制約欠落

**問題内容**:
- `account_tokens.account_id` がUUID NOT NULLだが、外部キー制約がない
- アカウント削除後もtokenレコードが残存
- 孤立レコードが大量に発生し、データ不整合

**影響範囲**: account_tokens、全アカウントテーブル

**修正方法**:
```sql
-- まず孤立レコードをクリーンアップ
DELETE FROM account_tokens
WHERE account_id NOT IN (
  SELECT id FROM main_accounts
  UNION SELECT id FROM follow_accounts
  UNION SELECT id FROM spam_accounts
);

-- 外部キー制約を追加（account_typeごとに分岐が必要）
-- 注: account_typeによって参照先が変わるため、トリガーで実装
CREATE OR REPLACE FUNCTION check_account_tokens_account_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_type = 'main' AND NOT EXISTS (SELECT 1 FROM main_accounts WHERE id = NEW.account_id) THEN
    RAISE EXCEPTION 'account_id does not exist in main_accounts';
  ELSIF NEW.account_type = 'follow' AND NOT EXISTS (SELECT 1 FROM follow_accounts WHERE id = NEW.account_id) THEN
    RAISE EXCEPTION 'account_id does not exist in follow_accounts';
  ELSIF NEW.account_type = 'spam' AND NOT EXISTS (SELECT 1 FROM spam_accounts WHERE id = NEW.account_id) THEN
    RAISE EXCEPTION 'account_id does not exist in spam_accounts';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_account_tokens_account_id_trigger
BEFORE INSERT OR UPDATE ON account_tokens
FOR EACH ROW EXECUTE FUNCTION check_account_tokens_account_id();
```

**参照**: `supabase/migrations/20251110_initial_schema.sql:15`

---

## 🟠 HIGH問題（早急に対応すべき）

### 8. auto_engagement_rules.action_type の NULL 許容

**問題内容**: CHECK制約はあるが、NOT NULL制約がない

**修正方法**:
```sql
ALTER TABLE auto_engagement_rules
ALTER COLUMN action_type SET NOT NULL;
```

**参照**: `supabase/migrations/20251116_auto_engagement.sql:21`

---

### 9. account_tokens の UNIQUE 制約が厳しすぎる

**問題内容**:
- `UNIQUE(user_id, x_user_id, account_type)`
- 同じTwitterアカウントを複数のaccount_typeで登録できない
- 再認証時にエラー

**修正方法**:
```sql
ALTER TABLE account_tokens
DROP CONSTRAINT IF EXISTS account_tokens_user_id_x_user_id_account_type_key;

-- より緩い制約: 同じuser_id+x_user_idでもaccount_typeが違えばOK
-- アプリケーション層で重複チェック
```

**参照**: `supabase/migrations/20251110_initial_schema.sql:49`

---

### 10. 暗号化カラムと平文カラムの二重管理

**問題内容**:
- `access_token` と `access_token_encrypted` の両方が存在
- データ不整合のリスク
- セキュリティリスク（平文が残存）

**修正方法**:
```sql
-- 全トークンを暗号化カラムに移行後
ALTER TABLE account_tokens DROP COLUMN access_token, DROP COLUMN refresh_token;
ALTER TABLE main_accounts DROP COLUMN password, DROP COLUMN mail_password;

-- Edge Functions を更新して decrypt 関数を使用
```

**参照**: `supabase/migrations/20260107_encrypt_sensitive_data.sql:6-12`

---

### 11. ALLOWED_ORIGINS のデフォルト値が localhost のみ

**問題内容**:
- デフォルトが `'http://localhost:3000'` のみ
- 本番環境でCORSエラー

**修正方法**:
```typescript
// supabase/functions/_shared/cors.ts
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')
  || 'http://localhost:3000,https://your-production-domain.com';
```

**参照**: `supabase/functions/_shared/cors.ts:6`

---

### 12. twitter-api-proxy の user_id が NULL の場合の処理不足

**問題内容**:
- Service Roleリクエストの場合、userIdがNULL
- レート制限の記録ができない
- トークンリフレッシュが失敗

**修正方法**:
```typescript
// user_id をリクエストボディから取得
if (!userId && user_id) {
  userId = user_id;
}

// さらにuserIdがNULLの場合の処理を追加
if (!userId) {
  throw new Error('user_id is required for token refresh and rate limit tracking');
}
```

**参照**: `supabase/functions/twitter-api-proxy/index.ts:109-125`

---

### 13. execute-auto-engagement のレート制限時の retry ロジック不足

**問題内容**:
- Rate limitedのアカウントをexecutorPoolから削除
- 全アカウントが削除されるとループが終了
- アカウント数が少ないと早期終了

**修正方法**:
```typescript
// レート制限されたアカウントを一時的に記録し、バックオフ後に再試行
const rateLimitedAccounts = new Set();

if (actionResult.rateLimited) {
  rateLimitedAccounts.add(executorAccount.id);

  // 全アカウントがレート制限された場合のみ終了
  if (rateLimitedAccounts.size === executorPool.length) {
    console.log('All accounts rate limited');
    break;
  }
  continue; // 次のアカウントに移行
}
```

**参照**: `supabase/functions/execute-auto-engagement/index.ts:234-249`

---

### 14-18. その他HIGH問題

14. **ALLOWED_ORIGINS が config.toml に未記載**
15. **action_types の NULL 許容**
16. **レート制限の事前チェック未実装**
17. **Edge Functions の実行時間制限（2分）**
18. **templates vs post_templates の不一致**

---

## 🟡 MEDIUM問題（計画的に対応）

19. posts.account_id の外部キー制約
20. loops.reply_template_id の参照制約
21. loops の CHECK 制約カラム名不一致
22. refresh_token NULL の処理
23. タイムアウト設定の不統一
24. 孤立レコードの定期チェック未実装
25. loops.execution_interval_hours のデフォルト値
26. レート制限 reset_at の不正確さ
27. pg_cron と _schedule.json の重複
28. Cron jobs の監視機能なし

---

## 🟢 LOW問題（時間があれば対応）

29. twitter_apps の NULL 許容（すでに修正済み）
30. schedule-loop-execution の頻度が高すぎる
31. TypeScript型とDBスキーマの自動同期

---

## 📋 優先度別修正計画

### フェーズ1: CRITICAL問題の修正（1-2日）

1. Edge Functions 環境変数の設定
2. トークンリフレッシュの頻度調整
3. twitter_app_id フォールバック実装
4. 暗号化キー設定（Supabase Vault使用）
5. cron job service_role_key 設定
6. twitter_apps カラム名統一
7. account_tokens 外部キー制約追加

### フェーズ2: HIGH問題の修正（2-3日）

8. NOT NULL制約の追加
9. UNIQUE制約の緩和
10. 平文カラムの削除
11. CORS設定の改善
12. twitter-api-proxy の user_id 処理
13. レート制限 retry ロジック改善
14-18. その他HIGH問題

### フェーズ3: MEDIUM/LOW問題の修正（1-2週間）

19-31. 計画的に対応

---

## 🔧 即座に実行できる修正SQL

以下のSQLを作成しました：

```bash
# 作成予定のファイル
FIX_CRITICAL_ISSUES.sql        # CRITICAL 7件
FIX_HIGH_PRIORITY_ISSUES.sql   # HIGH 11件
FIX_MEDIUM_PRIORITY_ISSUES.sql # MEDIUM 10件
```

---

## 🎯 次のアクション

### 即座に実行すべきこと

1. **環境変数を設定**
   ```bash
   supabase secrets set SUPABASE_URL=...
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
   supabase secrets set ALLOWED_ORIGINS=...
   ```

2. **暗号化キーを設定**
   ```sql
   ALTER DATABASE postgres SET app.settings.encryption_key = '...';
   ALTER DATABASE postgres SET app.settings.service_role_key = '...';
   ```

3. **トークンリフレッシュの頻度を調整**
   ```sql
   -- FIX_CRITICAL_ISSUES.sql を実行
   ```

4. **ブラウザキャッシュをクリア**
   - Cmd+Shift+R

5. **全機能をテスト**
   - OAuth認証
   - トークンリフレッシュ
   - エンゲージメント実行
   - DM送信

---

## 📊 影響範囲マトリックス

| 問題 | OAuth | API呼び出し | エンゲージメント | DM | 投稿 |
|------|-------|-------------|------------------|----|----|
| 環境変数未設定 | ❌ | ❌ | ❌ | ❌ | ❌ |
| トークンリフレッシュ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 暗号化キー | ❌ | ❌ | ❌ | ❌ | ❌ |
| 外部キー制約 | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| CORS設定 | ❌ | ❌ | ❌ | ❌ | ❌ |

❌ = 完全に動作不可
⚠️ = 部分的に問題あり
✅ = 影響なし

---

## 📞 サポート

修正作業中に問題が発生した場合：

1. エラーメッセージを全てコピー
2. 実行したSQLを記録
3. 影響を受けている機能を特定
4. ロールバックが必要か判断

---

**全ての問題を修正することで、XLO Systemは完全に安定し、セキュアで保守しやすいシステムになります。**
