# Stage3 Implementation - 一括投稿（Bulk Post Execution）

## 完了内容

### データベーステーブル追加

✅ **マイグレーションファイル作成**: `supabase/migrations/20251112_add_bulk_post_queue.sql`

#### bulk_post_queue テーブル

**目的**: 一括投稿キューの管理

**主要フィールド**:
- `template_id` - 使用するテンプレート
- `use_template_items` - テンプレートアイテムを使用するか
- `use_cta` - CTAを末尾に追加するか
- `cta_template_id` - 使用するCTAテンプレート
- `generated_content` - 生成されたコンテンツ（キャッシュ）
- `target_account_id` / `target_x_user_id` - 投稿元アカウント
- `status` - pending/processing/success/failed
- `retry_count` / `max_retries` / `next_retry_at` - リトライ管理
- `error_message` / `error_json` - エラー詳細
- `tweet_id` / `post_id` - Twitter投稿ID、postsテーブルへの参照
- `priority` - 優先度（1-10）

**ヘルパー関数**:
```sql
get_pending_bulk_posts(p_user_id, p_batch_size)
```
- `FOR UPDATE SKIP LOCKED` でロック競合を回避
- priority DESC, created_at ASC でソート

### Edge Function 実装

✅ **execute-bulk-posts** (`supabase/functions/execute-bulk-posts/index.ts`)

#### 機能

1. **キュー取得**
   - `get_pending_bulk_posts()` でバッチ取得
   - `FOR UPDATE SKIP LOCKED` で並行実行時の競合回避

2. **コンテンツ生成**
   - `post_templates` からテンプレート取得
   - `use_template_items=true` の場合:
     - `post_template_items` を取得
     - **重み付きランダム選択** (weight考慮)
     - 選択されたアイテムのusage_count++
   - `use_cta=true` の場合:
     - `cta_templates` から取得して末尾に追加
     - CTAのusage_count++
   - `generated_content` をキャッシュ保存

3. **Twitter投稿**
   - `twitter-api-proxy` Edge Function経由で `/2/tweets` にPOST
   - `x_user_id` または `account_id` でアカウント指定
   - レート制限ヘッダは `twitter-api-proxy` が自動記録

4. **結果記録**
   - **成功時**:
     - `posts` テーブルに新規レコード作成
     - `bulk_post_queue.status='success'`
     - `tweet_id`, `post_id`, `executed_at` 更新
   - **失敗時**:
     - `bulk_post_queue.status='failed'`
     - `error_message`, `error_json` 記録
     - `retry_count++`
     - `next_retry_at` を指数バックオフ計算（2^retry_count 分後）

5. **dryRun モード**
   - コンテンツ生成のみ実行
   - Twitter投稿はスキップ
   - 生成結果をプレビュー

#### リクエスト

```json
{
  "user_id": "uuid",
  "batch_size": 10,
  "dryRun": false
}
```

#### レスポンス

```json
{
  "success": true,
  "processed": 10,
  "succeeded": 8,
  "failed": 2,
  "samples": [
    {
      "queue_id": "uuid",
      "tweet_id": "1234567890",
      "text": "生成されたツイート本文",
      "status": "success"
    }
  ],
  "dryRun": false
}
```

### Next.js UI 実装

✅ **app/posts/page.tsx** - 一括投稿実行UI

#### 追加機能

1. **一括投稿実行ボタン**
   - 紫色のボタン（`bg-purple-600`）
   - アイコン: FileText
   - クリックで `handleBulkExecute(10)` 実行

2. **プレビューのみチェックボックス**
   - `dryRun` ステートで制御
   - チェック時は生成プレビューのみ、投稿なし

3. **実行結果表示**
   - 成功時: 緑背景（`bg-green-900/20`）
   - 失敗時: 赤背景（`bg-red-900/20`）
   - 処理数・成功数・失敗数を表示
   - 最大3件のサンプルツイートプレビュー
   - 10秒後に自動消去

4. **実行中インジケーター**
   - ボタンが `disabled` 状態
   - スピナーアイコンと「実行中...」表示

## アーキテクチャフロー

```
┌──────────────────┐
│   Next.js UI     │
│  (app/posts)     │
└────────┬─────────┘
         │
         │ 1. 一括投稿実行ボタンクリック (dryRun=false)
         ▼
┌──────────────────┐
│ execute-bulk-    │
│   posts          │ ← user_id, batch_size, dryRun
└────────┬─────────┘
         │
         │ 2. get_pending_bulk_posts() (FOR UPDATE SKIP LOCKED)
         ▼
┌──────────────────┐
│ bulk_post_queue  │ ← status='pending' を取得
│  (テーブル)      │
└────────┬─────────┘
         │ status='processing' に更新
         │
         │ 3. テンプレート取得＋重み付き選択
         ▼
┌──────────────────┐
│ post_templates   │
│ post_template_   │ ← weight考慮でランダム選択
│   items          │
│ cta_templates    │
└────────┬─────────┘
         │
         │ 4. コンテンツ生成
         ▼
┌──────────────────┐
│ generated_       │
│  content         │ ← 「テンプレート本文 + CTA」
└────────┬─────────┘
         │
         │ 5. twitter-api-proxy 経由で投稿
         ▼
┌──────────────────┐
│ twitter-api-     │
│   proxy          │ ← POST /2/tweets
└────────┬─────────┘
         │ Bearer token 付き
         │
         ▼
┌──────────────────┐
│ Twitter API v2   │
│  /2/tweets       │
└────────┬─────────┘
         │ tweet_id 返却
         │
         │ 6. 結果記録
         ▼
┌──────────────────┐
│ posts (テーブル) │ ← 新規レコード作成
│ bulk_post_queue  │ ← status='success', tweet_id, post_id 更新
└──────────────────┘
```

## デプロイ手順

### 1. データベースマイグレーション

Supabase Dashboard → SQL Editor:

```sql
-- 20251112_add_bulk_post_queue.sql の内容を実行
```

### 2. Edge Function デプロイ

```bash
supabase functions deploy execute-bulk-posts
```

### 3. 環境変数（既存設定を継承）

```
SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 検証チェックリスト

### ✅ フェーズ1: テーブルとテンプレート準備

1. [ ] `bulk_post_queue` テーブルが作成されている
2. [ ] `post_templates`, `post_template_items`, `cta_templates` に初期データ投入
   ```sql
   -- サンプルデータ
   INSERT INTO post_templates (user_id, title, content, is_active)
   VALUES ('your-user-id', 'テストテンプレート', 'これはテストです', true);

   INSERT INTO post_template_items (user_id, template_id, content, weight, is_active)
   VALUES
     ('your-user-id', 'template-id', 'バリエーション1', 3, true),
     ('your-user-id', 'template-id', 'バリエーション2', 7, true);

   INSERT INTO cta_templates (user_id, name, content, is_active)
   VALUES ('your-user-id', 'テストCTA', 'いいねとフォローお願いします！', true);
   ```

3. [ ] `bulk_post_queue` にテストキューを投入
   ```sql
   INSERT INTO bulk_post_queue (user_id, template_id, use_template_items, use_cta, cta_template_id, status, target_x_user_id)
   VALUES
     ('your-user-id', 'template-id', true, true, 'cta-id', 'pending', 'your-x-user-id'),
     ('your-user-id', 'template-id', true, true, 'cta-id', 'pending', 'your-x-user-id'),
     ('your-user-id', 'template-id', true, true, 'cta-id', 'pending', 'your-x-user-id');
   ```

### ✅ フェーズ2: dryRun プレビュー

1. [ ] `/posts` で「プレビューのみ」チェック
2. [ ] 「一括投稿実行」ボタンクリック
3. [ ] 結果通知で生成されたコンテンツが表示される
4. [ ] `bulk_post_queue` の `generated_content` が保存されている
5. [ ] `status='pending'` のまま（投稿されていない）

### ✅ フェーズ3: 実投稿

1. [ ] 「プレビューのみ」チェックを外す
2. [ ] 「一括投稿実行」ボタンクリック
3. [ ] Twitter に実際に投稿される
4. [ ] `posts` テーブルに新規レコード（status='posted', tweet_id 有り）
5. [ ] `bulk_post_queue` が `status='success'`, `tweet_id`, `post_id` 更新
6. [ ] `post_template_items.usage_count`, `cta_templates.usage_count` がインクリメント

### ✅ フェーズ4: エラーハンドリング

1. [ ] 無効なトークンで実行 → `status='failed'`, `error_message` 記録
2. [ ] `retry_count` がインクリメント
3. [ ] `next_retry_at` が指数バックオフ計算（1分後、2分後、4分後...）

## 重要な実装詳細

### 重み付きランダム選択アルゴリズム

```typescript
function selectByWeight<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}
```

**例**: アイテムA(weight=3), アイテムB(weight=7) の場合:
- totalWeight = 10
- random = 0~10 の乱数
- 0~3: アイテムA選択（30%）
- 3~10: アイテムB選択（70%）

### リトライ戦略（指数バックオフ）

```typescript
const retryCount = queueItem.retry_count + 1;
const shouldRetry = retryCount < queueItem.max_retries; // max_retries=3

next_retry_at = shouldRetry
  ? new Date(Date.now() + Math.pow(2, retryCount) * 60000).toISOString()
  : null;
```

**リトライ間隔**:
- 1回目失敗: 2^1 = 2分後
- 2回目失敗: 2^2 = 4分後
- 3回目失敗: 2^3 = 8分後
- 4回目以降: リトライなし（max_retries=3）

### FOR UPDATE SKIP LOCKED の効果

```sql
SELECT * FROM bulk_post_queue
WHERE user_id = p_user_id
  AND status = 'pending'
ORDER BY priority DESC, created_at ASC
LIMIT p_batch_size
FOR UPDATE SKIP LOCKED;
```

**メリット**:
- 複数の `execute-bulk-posts` インスタンスが並行実行されても競合しない
- ロック済みの行はスキップして次の行を取得
- デッドロックを回避

## 次のStage4への準備

Stage3完了後、以下を実装予定:

1. **execute-loop** - ループ実行Edge Function
   - `loops` テーブルから `next_run <= now` を取得
   - `executor_account_ids` からランダム選定
   - テンプレート取得 → 投稿生成 → twitter-api-proxy で投下
   - `loop_executions` に記録

2. **schedule-loop-execution** - Cronトリガー
   - 10分ごとに `execute-loop` を呼び出し
   - `supabase/functions/_schedule.json` で設定

3. **UI改善**
   - `/loops` に「今すぐ実行」ボタン
   - 実行履歴タブで `loop_executions` を一覧表示

## ファイル一覧

### マイグレーション
- `supabase/migrations/20251112_add_bulk_post_queue.sql` - bulk_post_queueテーブル

### Edge Functions
- `supabase/functions/execute-bulk-posts/index.ts` - 一括投稿実行

### Next.js
- `app/posts/page.tsx` - 一括投稿実行UI追加

## トラブルシューティング

### エラー: "No pending posts in queue"
- `bulk_post_queue` にデータが投入されているか確認
- `status='pending'` かつ `scheduled_at` が null または過去になっているか確認

### エラー: "Template not found or inactive"
- `post_templates` に有効なテンプレートがあるか確認
- `is_active=true` になっているか確認

### エラー: "No active template items found"
- `post_template_items` に有効なアイテムがあるか確認
- `use_template_items=true` の場合、最低1件は必要

### エラー: "No valid access token found"
- OAuth2接続が完了しているか確認（Stage2）
- `account_tokens` に `token_type='oauth2'` で有効なトークンがあるか確認
- `expires_at` が未来日時か確認

### Twitter API エラー
- レート制限に達していないか `rate_limits` テーブルを確認
- `/2/tweets` は 17リクエスト/15分 の制限あり
- トークンのスコープに `tweet.write` が含まれているか確認
