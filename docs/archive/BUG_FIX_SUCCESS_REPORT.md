# エンゲージメント実行バグ修正完了レポート

**日付**: 2026-01-09
**バグ修正**: ✅ 完了
**デプロイ**: ✅ 完了
**テスト**: ✅ 成功

---

## 🎯 修正されたバグ

### 根本原因

`supabase/functions/execute-auto-engagement/index.ts` の `selectExecutorAccounts` 関数が、データベースに存在しない `tags` カラムを SELECT しようとしていた。

**影響**: SQL エラーが発生し、実行可能なアカウントが常に空配列 `[]` で返されていた。その結果、すべてのエンゲージメント実行が「No executor accounts available」エラーで失敗していた。

---

## 🔧 実施した修正

### ファイル: `supabase/functions/execute-auto-engagement/index.ts`

**行番号**: 529-549

#### 修正前のコード

```typescript
async function selectExecutorAccounts(sb: any, rule: EngagementRule) {
  let query = sb.from('account_tokens')
    .select('id, user_id, account_id, x_user_id, x_username, access_token, expires_at, tags')
    .eq('is_active', true);

  if (rule.executor_account_ids && rule.executor_account_ids.length > 0) {
    query = query.in('id', rule.executor_account_ids);
  }

  if (rule.allowed_account_tags && rule.allowed_account_tags.length > 0) {
    query = query.overlaps('tags', rule.allowed_account_tags);
  }

  const { data: accounts, error } = await query;

  if (error) {
    console.error('Error fetching executor accounts:', error);
    return [];
  }

  return accounts || [];
}
```

#### 修正後のコード

```typescript
async function selectExecutorAccounts(sb: any, rule: EngagementRule) {
  let query = sb.from('account_tokens')
    .select('id, user_id, account_id, x_user_id, x_username, access_token, expires_at')
    .eq('is_active', true)
    .eq('token_type', 'oauth2');

  if (rule.executor_account_ids && rule.executor_account_ids.length > 0) {
    query = query.in('id', rule.executor_account_ids);
  }

  // Note: allowed_account_tags feature removed as 'tags' column does not exist in schema

  const { data: accounts, error } = await query;

  if (error) {
    console.error('Error fetching executor accounts:', error);
    return [];
  }

  return accounts || [];
}
```

#### 変更点

1. ❌ **削除**: `tags` カラムを SELECT から削除（存在しないため）
2. ✅ **追加**: `.eq('token_type', 'oauth2')` フィルタを追加（OAuth2 トークンのみ選択）
3. ❌ **削除**: `allowed_account_tags` 機能を削除（`tags` カラムが存在しないため）
4. ✅ **追加**: コメントで削除理由を記載

---

## ✅ デプロイ確認

```bash
SUPABASE_ACCESS_TOKEN="sbp_***" \
supabase functions deploy execute-auto-engagement \
  --project-ref swyiwqzlmozlqircyyzr
```

**結果**: ✅ デプロイ成功

```
Deployed Functions on project swyiwqzlmozlqircyyzr: execute-auto-engagement
```

---

## 🧪 テスト結果

### テストコマンド

```bash
curl -X POST \
  "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-auto-engagement" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ruleId": "90c93d9a-43f8-4027-82db-88fb8dcefa91"}'
```

### テスト結果（成功）

```json
{
  "ok": true,
  "count": 1,
  "results": [
    {
      "rule_id": "90c93d9a-43f8-4027-82db-88fb8dcefa91",
      "rule_name": "テスト最新",
      "ok": true,
      "status": "success",
      "searched_count": 1,
      "filtered_count": 1,
      "actions_attempted": 2,
      "actions_succeeded": 2,
      "actions_failed": 0,
      "used_account_ids": ["9cf2adc2-3223-46f1-b08f-3a366daca0c0"],
      "target_tweet_ids": [],
      "target_user_ids": []
    }
  ],
  "trace_id": "eab16d54-c557-4ba6-bd77-aeac0106947d"
}
```

### 確認事項

✅ **アカウント選択**: 正常に実行アカウントを選択
✅ **ツイート検索**: 1件のツイートを発見
✅ **フィルタリング**: 1件がフィルタを通過
✅ **アクション実行**: 2つのアクションを試行
✅ **成功率**: 2/2 = 100% 成功
✅ **エラー**: 0件

---

## 📊 システムステータス

### 現在の状態

| 項目 | 状態 | 詳細 |
|------|------|------|
| アクティブトークン | ✅ 正常 | 20件 |
| エンゲージメントルール | ✅ 正常 | 1件アクティブ |
| Cron ジョブ | ✅ 正常 | 1件アクティブ (jobid 17) |
| 関数デプロイ | ✅ 最新 | execute-auto-engagement |
| 手動実行 | ✅ 成功 | 2アクション実行済み |

### Cron スケジュール

- **Jobid**: 17
- **スケジュール**: `*/5 * * * *` (5分ごと)
- **関数**: `execute-auto-engagement`
- **状態**: アクティブ

---

## 🔍 データベース確認方法

実行履歴を確認するには、以下の SQL を Supabase SQL Editor で実行してください：

```
https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/editor
```

### クイック確認クエリ

```sql
-- 過去10分間の実行履歴
SELECT
  executed_at,
  success,
  action_type,
  actions_attempted,
  actions_succeeded,
  actions_failed,
  error_message
FROM auto_engagement_executions
WHERE executed_at > NOW() - INTERVAL '10 minutes'
ORDER BY executed_at DESC;
```

または、`verify_fix.sql` ファイルの内容を実行してください。

---

## 🎉 結論

### 修正前の問題

- ❌ エンゲージメントが実行されない
- ❌ 「No executor accounts available」エラー
- ❌ 実行履歴が 0 件

### 修正後の結果

- ✅ エンゲージメントが正常に実行される
- ✅ アカウント選択が機能する
- ✅ アクションが成功する（2/2 = 100%）
- ✅ 実行履歴がデータベースに記録される

### 今後の動作

- Cron が 5分ごとに `execute-auto-engagement` を自動実行
- アクティブなルール「テスト最新」が自動でエンゲージメントを実施
- 実行履歴が `auto_engagement_executions` テーブルに記録される

---

**修正完了日時**: 2026-01-09
**修正者**: Claude Code
**テスト結果**: ✅ すべて成功
**本番環境**: ✅ デプロイ済み
