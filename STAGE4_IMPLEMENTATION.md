# Stage4 Implementation - ループ実行 + Cron（10分間隔）

## 完了内容

### Edge Functions 実装

✅ **execute-loop** (`supabase/functions/execute-loop/index.ts`)

#### 機能

1. **ループ抽出**
   - `loops` テーブルから実行対象を取得
   - 条件: `is_active=true` AND (`next_execution_at IS NULL` OR `next_execution_at <= NOW()`)
   - 最大20件を優先度順に取得

2. **アカウント選定**
   - `executor_account_ids` が指定されている場合はその中からランダム選択
   - 未指定の場合は `main_accounts` から選択
   - `allowed_account_tags` でフィルタリング（オプション）
   - `min_account_count` ~ `max_account_count` の範囲でランダム決定

3. **コンテンツ生成**
   - `reply_template_id` から `post_templates` 取得
   - `post_template_items` を **重み付きランダム選択**
   - `usage_count` をインクリメント

4. **Twitter投稿**
   - `twitter-api-proxy` 経由で各アカウントから投稿
   - 成功時は `posts` テーブルに記録

5. **実行ログ記録**
   - `loop_executions` に結果保存
   - `created_posts_count`, `sent_replies_count`, `used_account_ids`, `status`, `exec_data`

6. **次回実行時間更新**
   - `next_execution_at = NOW() + execution_interval_hours`
   - `last_execution_at`, `post_count` を更新

#### リクエスト

```bash
POST /functions/v1/execute-loop
```

#### レスポンス

```json
{
  "ok": true,
  "count": 3,
  "results": [
    {
      "loop_id": "uuid",
      "ok": true,
      "posts_created": 2
    }
  ]
}
```

---

✅ **schedule-loop-execution** (`supabase/functions/schedule-loop-execution/index.ts`)

#### 機能

- Cronトリガーから呼び出され、`execute-loop` を実行する単純なプロキシ
- 実行結果をログ出力

#### リクエスト

```bash
POST /functions/v1/schedule-loop-execution
```

#### レスポンス

```json
{
  "ok": true,
  "forwarded": { /* execute-loop の結果 */ },
  "timestamp": "2025-11-12T..."
}
```

---

### Cron 設定

✅ **_schedule.json** (`supabase/functions/_schedule.json`)

```json
{
  "version": 1,
  "functions": [
    {
      "name": "schedule-loop-execution",
      "schedule": "*/10 * * * *",
      "description": "Execute loops every 10 minutes"
    }
  ]
}
```

**スケジュール**: 10分ごとに実行（要件準拠）

---

### Next.js UI 実装

✅ **app/loops/page.tsx** - ループ管理UI拡張

#### 追加機能

1. **「今すぐ実行」ボタン**
   - 緑色のボタン（`bg-green-600`）
   - アイコン: PlayCircle
   - クリックで `handleExecuteNow()` 実行
   - 実行中はスピナー表示 + disabled

2. **実行結果通知**
   - 成功時: 緑背景（`bg-green-900/20`）
   - 失敗時: 赤背景（`bg-red-900/20`）
   - 実行数と各ループの投稿数を表示
   - 10秒後に自動消去

3. **既存機能との統合**
   - 実行後は自動的にループリストを再読み込み
   - 統計カードも更新される

---

### 検証用SQLスクリプト

✅ **supabase/validation/check_loop_execution.sql**

#### 含まれるクエリ

1. ループ実行可能なレコード
2. 最近のループ実行ログ
3. レート制限最新値
4. 直近の投稿（重複防止確認用）
5. アクティブなループの統計
6. ループ実行成功率
7. 今日のループ実行履歴（時間別）
8. エラーが多いループ（要確認）
9. 次回実行予定のループ
10. アカウント別投稿数（ループ経由）

---

## アーキテクチャフロー

```
┌──────────────────┐
│   Cron Trigger   │
│  (*/10 * * * *)  │ ← 10分ごとに実行
└────────┬─────────┘
         │
         │ 1. POST /schedule-loop-execution
         ▼
┌──────────────────┐
│ schedule-loop-   │
│  execution       │ ← プロキシ役
└────────┬─────────┘
         │
         │ 2. POST /execute-loop
         ▼
┌──────────────────┐
│  execute-loop    │
└────────┬─────────┘
         │
         │ 3. ループ抽出
         ▼
┌──────────────────┐
│  loops           │ ← is_active=true, next_execution_at <= NOW()
│  (テーブル)      │
└────────┬─────────┘
         │
         │ 4. アカウント選定
         ▼
┌──────────────────┐
│ main_accounts    │ ← min/max count, allowed_tags
└────────┬─────────┘
         │
         │ 5. テンプレート取得
         ▼
┌──────────────────┐
│ post_templates   │
│ post_template_   │ ← 重み付き選択
│   items          │
└────────┬─────────┘
         │
         │ 6. 投稿実行
         ▼
┌──────────────────┐
│ twitter-api-     │
│   proxy          │ ← POST /2/tweets × N accounts
└────────┬─────────┘
         │
         │ 7. 結果記録
         ▼
┌──────────────────┐
│ posts            │ ← 投稿レコード作成
│ loop_executions  │ ← 実行ログ記録
│ loops            │ ← next_execution_at 更新
└──────────────────┘
```

---

## デプロイ手順

### 1. Edge Functions デプロイ

```bash
supabase functions deploy execute-loop
supabase functions deploy schedule-loop-execution
```

### 2. 環境変数設定

Supabase Dashboard → Edge Functions → Configuration:

```
SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

**重要**: 両方の関数に上記3つの環境変数を設定してください。

### 3. Cron 有効化

Supabase Dashboard → Edge Functions → schedule-loop-execution:
- Cron式が `*/10 * * * *` になっていることを確認
- Enable Cron をオンにする

---

## 検証チェックリスト

### ✅ フェーズ1: 手動実行テスト

1. **テストデータ準備**

```sql
-- テンプレート作成
INSERT INTO post_templates (user_id, title, content, is_active)
VALUES ('your-user-id', 'ループテストテンプレート', 'ループからのテスト投稿', true)
RETURNING id;

-- テンプレートアイテム作成
INSERT INTO post_template_items (user_id, template_id, content, weight, is_active)
VALUES
  ('your-user-id', 'template-id', 'パターンA', 5, true),
  ('your-user-id', 'template-id', 'パターンB', 3, true),
  ('your-user-id', 'template-id', 'パターンC', 2, true);

-- ループ作成
INSERT INTO loops (
  user_id,
  loop_name,
  description,
  is_active,
  execution_interval_hours,
  min_account_count,
  max_account_count,
  reply_template_id
)
VALUES (
  'your-user-id',
  'テストループ',
  '10分ごとに自動投稿するテストループ',
  true,
  24,
  1,
  2,
  'template-id'
)
RETURNING id;
```

2. **UI から手動実行**
   - [ ] `/loops` で「今すぐ実行」ボタンクリック
   - [ ] 結果通知で実行数と投稿数が表示される
   - [ ] `loop_executions` にレコードが作成される
   - [ ] `posts` にツイートが記録される（tweet_id有り）
   - [ ] Twitter に実際に投稿される

3. **cURL で直接実行**

```bash
curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/execute-loop" \
  -H "Authorization: Bearer ${ANON_KEY}" | jq .
```

### ✅ フェーズ2: Cron 自動実行確認

1. [ ] Cron が有効化されている
2. [ ] 10分後に自動実行される
3. [ ] Supabase Logs で `schedule-loop-execution` と `execute-loop` のログが確認できる
4. [ ] `loop_executions` に新しいレコードが自動的に追加される
5. [ ] `loops.next_execution_at` が更新されている

### ✅ フェーズ3: 検証SQLで確認

```sql
-- 1. ループ実行可能なレコード
SELECT id, loop_name, is_active, next_execution_at
FROM loops
WHERE is_active = true
ORDER BY next_execution_at ASC NULLS FIRST
LIMIT 10;

-- 2. 最近のループ実行ログ
SELECT executed_at, loop_id, created_posts_count, status
FROM loop_executions
ORDER BY executed_at DESC
LIMIT 20;

-- 3. アクティブなループの統計
SELECT
  COUNT(*) as total_loops,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_loops,
  SUM(post_count) as total_posts
FROM loops;
```

---

## 重要な実装詳細

### アカウント選定ロジック

```typescript
async function pickAccounts(sb: any, loop: any): Promise<string[]> {
  const minCount = loop.min_account_count || 1;
  const maxCount = loop.max_account_count || 5;
  const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;

  // Use executor_account_ids if specified
  if (loop.executor_account_ids && loop.executor_account_ids.length > 0) {
    const shuffled = [...loop.executor_account_ids].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // Otherwise, select from main_accounts
  // Filter by allowed_account_tags if specified
  ...
}
```

**特徴**:
- `min_account_count` ~ `max_account_count` の範囲でランダム決定
- `executor_account_ids` 優先
- `allowed_account_tags` でフィルタリング

### 次回実行時間計算

```typescript
function calcNextRun(loop: any): string {
  const intervalHours = loop.execution_interval_hours || 24;
  const next = new Date();
  next.setHours(next.getHours() + intervalHours);
  return next.toISOString();
}
```

**注意**: Cronは10分ごとに実行されますが、各ループの実際の実行間隔は `execution_interval_hours` で制御されます。

---

## トラブルシューティング

### エラー: "No loops ready to execute"

- `loops` テーブルに `is_active=true` のレコードがあるか確認
- `next_execution_at` が NULL または過去になっているか確認

### エラー: "No executor accounts available"

- `executor_account_ids` が空でないか確認
- または `main_accounts` に有効なアカウントがあるか確認
- `allowed_account_tags` の条件が厳しすぎないか確認

### エラー: "Template not found or inactive"

- `reply_template_id` が正しく設定されているか確認
- `post_templates` に該当テンプレートがあり、`is_active=true` か確認

### Cron が実行されない

- Supabase Dashboard で Cron が有効化されているか確認
- `_schedule.json` の記法が正しいか確認
- Supabase Logs で実行エラーがないか確認

### Twitter API エラー

- `rate_limits` テーブルでレート制限に達していないか確認
- `account_tokens` のトークンが有効か確認（expires_at）

---

## 次のStage5への準備

Stage4完了後、以下を実装予定:

1. **execute-auto-engagement** - 自動エンゲージメントEdge Function
   - `auto_engagement_rules` から実行対象を抽出
   - キーワード/URL/ユーザー検索
   - フィルタリング（フォロワー数、アカウント年齢、除外KW）
   - like/reply/follow アクション実行
   - `auto_engagement_executions` に記録

2. **ハードニング**
   - 投稿重複防止（24h以内の同一テキストをブロック）
   - レート制限保護（remaining < 20%で警告）
   - 二重実行防止（ロックフラグ `locked_until`）
   - プロキシ割当と失敗率管理

3. **UI改善**
   - `/engagement` にルール管理 + 今すぐ実行 + 履歴タブ
   - ダッシュボードにレート制限モニター（実データ接続）

---

## ファイル一覧

### Edge Functions
- `supabase/functions/execute-loop/index.ts` - ループ実行
- `supabase/functions/schedule-loop-execution/index.ts` - Cronトリガー
- `supabase/functions/_schedule.json` - Cron設定

### Next.js
- `app/loops/page.tsx` - ループ管理UI（今すぐ実行ボタン追加）

### 検証
- `supabase/validation/check_loop_execution.sql` - 検証用クエリ集

---

## 参考: Cron 式の例

```
*/10 * * * *    # 10分ごと
0 * * * *       # 1時間ごと（毎時0分）
0 */2 * * *     # 2時間ごと
0 0 * * *       # 毎日0時
0 9-17 * * 1-5  # 平日9-17時の毎時0分
```

現在の設定: `*/10 * * * *` = 10分ごと（要件準拠）
