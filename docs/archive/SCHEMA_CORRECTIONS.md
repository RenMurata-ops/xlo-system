# スキーマ修正レポート

**日付**: 2026-01-09
**問題**: SQL クエリが間違ったテーブル名・カラム名を使用していた

---

## 発見された問題

### 1. テーブル名の誤り

**誤**: `engagement_execution_history`
**正**: `auto_engagement_executions`

**エラーメッセージ**:
```
ERROR: 42P01: relation "engagement_execution_history" does not exist
```

### 2. カラム名の誤り

**誤**: `status` (string型で 'success', 'error' を想定)
**正**: `success` (boolean型で true/false)

**エラーメッセージ**:
```
ERROR: 42703: column "status" does not exist
```

---

## 正しいスキーマ

### auto_engagement_executions テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | string | 実行ID |
| `rule_id` | string | ルールID |
| `user_id` | string | ユーザーID |
| `executor_account_id` | string | 実行アカウントID |
| `executed_at` | timestamp | 実行日時 |
| **`success`** | **boolean** | 成功フラグ (true = 成功, false = 失敗) |
| `error_message` | string \| null | エラーメッセージ |
| `action_type` | string | アクション種別 |
| `actions_attempted` | number \| null | 試行数 |
| `actions_succeeded` | number \| null | 成功数 |
| `actions_failed` | number \| null | 失敗数 |
| `searched_count` | number \| null | 検索数 |
| `filtered_count` | number \| null | フィルタ後数 |
| `target_user_id` | string \| null | 対象ユーザーID |
| `target_user_ids` | string[] \| null | 対象ユーザーIDs |
| `target_tweet_id` | string \| null | 対象ツイートID |
| `target_tweet_ids` | string[] \| null | 対象ツイートIDs |
| `target_username` | string \| null | 対象ユーザー名 |
| `used_account_ids` | string[] \| null | 使用アカウントIDs |
| `error_json` | json \| null | エラー詳細 |
| `exec_data` | json \| null | 実行データ |
| `metadata` | json \| null | メタデータ |
| `trace_id` | string \| null | トレースID |

---

## 修正した WHERE 句の例

### 誤った記述
```sql
-- ❌ 間違い
SELECT COUNT(*)
FROM engagement_execution_history
WHERE status = 'success';
```

### 正しい記述
```sql
-- ✅ 正しい
SELECT COUNT(*)
FROM auto_engagement_executions
WHERE success = true;
```

### フィルタ条件の修正

```sql
-- ❌ 間違い
COUNT(*) FILTER (WHERE status = 'success')
COUNT(*) FILTER (WHERE status = 'error')

-- ✅ 正しい
COUNT(*) FILTER (WHERE success = true)
COUNT(*) FILTER (WHERE success = false)
```

---

## 修正したファイル

1. ✅ `check_production_status.sql` - すべてのクエリを修正
2. ✅ `PRODUCTION_STATUS_CHECK.md` - ドキュメント内のクエリを修正
3. ✅ `OPERATIONS_GUIDE.md` - 監視クエリを修正
4. ✅ `quick_check.sql` - クイック確認クエリを修正
5. ✅ `quick_check_fixed.sql` - 新規作成（完全に正しいバージョン）

---

## テスト済みクエリ

### 1. アクティブトークン確認（動作確認済み）

```sql
SELECT
  account_type,
  COUNT(*) as active_count,
  STRING_AGG(x_username, ', ' ORDER BY x_username) as usernames
FROM account_tokens
WHERE is_active = true
  AND token_type = 'oauth2'
GROUP BY account_type
ORDER BY account_type;
```

### 2. 実行統計（修正後）

```sql
SELECT
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  COUNT(*) FILTER (WHERE error_message LIKE '%429%') as rate_limit_errors,
  ROUND(
    (COUNT(*) FILTER (WHERE success = true)::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) as success_rate_percent
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '24 hours';
```

### 3. 総合ステータス（修正後）

```sql
WITH token_count AS (
  SELECT COUNT(*) as active_tokens
  FROM account_tokens
  WHERE is_active = true AND token_type = 'oauth2'
),
recent_stats AS (
  SELECT
    COUNT(*) as total_exec,
    COUNT(*) FILTER (WHERE error_message LIKE '%429%') as rate_errors,
    COUNT(*) FILTER (WHERE success = false) as total_errors
  FROM auto_engagement_executions
  WHERE executed_at > NOW() - INTERVAL '1 hour'
)
SELECT
  '🔹 トークン' as check_item,
  CASE
    WHEN tc.active_tokens = 0 THEN '🚨 0件'
    WHEN tc.active_tokens < 3 THEN '⚠️ ' || tc.active_tokens || '件'
    ELSE '✅ ' || tc.active_tokens || '件'
  END as status
FROM token_count tc
UNION ALL
SELECT
  '🔹 エンゲージメント',
  CASE
    WHEN rs.total_exec = 0 THEN '⚪ 実行なし'
    WHEN rs.rate_errors::NUMERIC / NULLIF(rs.total_exec, 0) > 0.1 THEN '🚨 429頻発'
    WHEN rs.rate_errors > 0 THEN '⚠️ 429あり'
    ELSE '✅ 正常'
  END
FROM recent_stats rs;
```

---

## 推奨される使用方法

### ステップ 1: quick_check_fixed.sql を使用

最も信頼性の高いクエリセットです：

1. **Supabase SQL Editor を開く**
   ```
   https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/editor
   ```

2. **quick_check_fixed.sql の内容をコピペ**

3. **実行して結果を確認**

### ステップ 2: 問題があれば詳細確認

- トークンに問題 → `check_production_status.sql` のセクション 1-2 を実行
- 429 エラーがある → セクション 3 を実行
- レート制限が心配 → セクション 4 を実行

---

## 今後の注意点

### スキーマ確認の方法

新しいクエリを書く前に、必ず `types/database.ts` でスキーマを確認してください：

```bash
# テーブル構造を確認
grep -A 30 "auto_engagement_executions: {" types/database.ts
```

### よくある間違い

1. ❌ `status` カラムを使う → ✅ `success` (boolean) を使う
2. ❌ `WHERE status = 'success'` → ✅ `WHERE success = true`
3. ❌ `engagement_execution_history` → ✅ `auto_engagement_executions`

---

**作成日**: 2026-01-09
**検証済み**: すべてのクエリをスキーマに基づいて修正
**関連ファイル**: types/database.ts (line 368-)
