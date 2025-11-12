# Phase 3: Auto-Engagement System Implementation

## 概要

自動エンゲージメントシステムを実装しました。キーワード・URL・ユーザーベースの3種類のルールで、大規模な自動エンゲージメント実行を実現します。

## 実装Edge Functions

### 1. execute-auto-engagement

**目的**: エンゲージメントルールの自動実行

**実行**: 手動 or スケジュール（推奨: 1時間ごと）

**サポートするルールタイプ**:

#### A. キーワード型 (keyword)
- Twitter Search APIで特定キーワードを検索
- 除外キーワードでフィルタリング
- フォロワー数・アカウント年齢でフィルタリング
- いいね/リプライ/フォロー/RTを自動実行

**設定例**:
```json
{
  "rule_type": "keyword",
  "search_keywords": ["副業 始めたい", "在宅ワーク 探してる"],
  "exclude_keywords": ["詐欺", "怪しい", "MLM"],
  "action_types": ["like", "follow"],
  "executor_account_ids": ["uuid1", "uuid2"],
  "max_accounts_per_run": 3,
  "min_followers": 100,
  "max_followers": 10000
}
```

#### B. URL型 (url)
- 特定ツイートURLへの集中エンゲージメント
- 複数アカウントから一斉アクション
- トレンド入り・バズ狙い

**設定例**:
```json
{
  "rule_type": "url",
  "target_urls": [
    "https://twitter.com/competitor/status/123456"
  ],
  "action_types": ["like", "retweet"],
  "executor_account_ids": [/* 100アカウント */]
}
```

#### C. ユーザー型 (user)
- 特定ユーザーの新規投稿を監視
- 自動エンゲージメント実行
- VIP顧客・インフルエンサー対応

**設定例**:
```json
{
  "rule_type": "user",
  "target_user_ids": ["123456789", "987654321"],
  "action_types": ["like", "reply"],
  "reply_template_id": "uuid",
  "executor_account_ids": ["uuid1", "uuid2"]
}
```

**アクション種類**:
- **like** - いいね（レート制限: 1000回/24時間）
- **reply** - リプライ（レート制限: 300回/3時間）
- **follow** - フォロー（レート制限: 400回/24時間）
- **retweet** - リツイート（レート制限: 無制限）

**処理フロー**:
1. ルール取得（rule_id指定 or user_id全件）
2. executor_account_idsからトークン検証
3. validate-and-refresh-tokens呼び出し
4. 有効なアカウントでアクション実行
5. auto_engagement_executionsに記録
6. ルール統計更新

**レスポンス例**:
```json
{
  "success": true,
  "message": "Executed 3 rules",
  "total_actions": 45,
  "total_successes": 42,
  "total_failures": 3,
  "results": [
    {
      "rule_id": "uuid",
      "rule_name": "キーワード監視",
      "actions_performed": 15,
      "successes": 14,
      "failures": 1
    }
  ]
}
```

### 2. auto-unfollow-scheduler

**目的**: スケジュールされた自動アンフォロー実行

**実行**: Cron（推奨: 1時間ごと）

**処理フロー**:
1. follow_historyから scheduled_unfollow_at <= 現在時刻 のレコード取得
2. status = 'following' AND auto_unfollow_enabled = true フィルタ
3. アカウントごとにグループ化
4. アンフォロー実行（Twitter API DELETE）
5. status = 'unfollowed', unfollowed_at 更新
6. 通知送信（失敗時 or 50件以上成功時）

**特徴**:
- アカウント別バッチ処理
- レート制限保護（2秒/アンフォロー）
- アカウント間5秒待機
- 最大100件/実行

**自動アンフォロー設定**:
```typescript
// エンゲージメントルールで設定
{
  "auto_unfollow_enabled": true,
  "unfollow_after_days": 7  // 7日後に自動アンフォロー
}

// follow_historyに自動計算
{
  "followed_at": "2025-11-12T10:00:00Z",
  "scheduled_unfollow_at": "2025-11-19T10:00:00Z",  // 7日後
  "auto_unfollow_enabled": true,
  "status": "following"
}
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "Processed 85 unfollows",
  "processed": 85,
  "succeeded": 80,
  "failed": 3,
  "skipped": 2,
  "results": [
    {
      "follow_id": "uuid",
      "account_id": "uuid",
      "target_user_id": "123456",
      "target_username": "@user123",
      "status": "success"
    }
  ]
}
```

## データベーステーブル

### auto_engagement_rules

エンゲージメントルール設定:
```sql
CREATE TABLE auto_engagement_rules (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('keyword', 'url', 'user')),
  is_active BOOLEAN DEFAULT true,

  -- Search Settings
  search_keywords TEXT[],
  exclude_keywords TEXT[],
  target_urls TEXT[],
  target_user_ids TEXT[],

  -- Filters
  min_followers INTEGER DEFAULT 0,
  max_followers INTEGER,
  account_age_days INTEGER DEFAULT 0,

  -- Actions
  action_types TEXT[] NOT NULL,  -- ['like', 'reply', 'follow', 'retweet']
  reply_template_id UUID,

  -- Execution
  executor_account_ids UUID[],
  max_accounts_per_run INTEGER DEFAULT 1,

  -- Auto Unfollow
  auto_unfollow_enabled BOOLEAN DEFAULT false,
  unfollow_after_days INTEGER DEFAULT 7,

  -- Stats
  last_execution_at TIMESTAMPTZ,
  total_executions INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0
);
```

### auto_engagement_executions

実行ログ:
```sql
CREATE TABLE auto_engagement_executions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_id UUID NOT NULL,
  executor_account_id UUID,
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'reply', 'follow', 'retweet')),
  target_tweet_id TEXT,
  target_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  response_data JSONB,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### follow_history

フォロー履歴と自動アンフォロー:
```sql
CREATE TABLE follow_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  target_user_id TEXT NOT NULL,
  target_username TEXT NOT NULL,

  followed_at TIMESTAMPTZ DEFAULT NOW(),
  unfollowed_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'following' CHECK (status IN ('following', 'unfollowed', 'failed')),

  -- Auto Unfollow
  auto_unfollow_enabled BOOLEAN DEFAULT false,
  unfollow_after_days INTEGER DEFAULT 7,
  scheduled_unfollow_at TIMESTAMPTZ,

  engagement_rule_id UUID,
  metadata JSONB
);

CREATE INDEX idx_follow_history_scheduled_unfollow_at
  ON follow_history(scheduled_unfollow_at)
  WHERE status = 'following' AND auto_unfollow_enabled = true;
```

## Cronスケジュール設定

### 1. execute-auto-engagement（推奨）

```sql
SELECT cron.schedule(
  'execute-auto-engagement-hourly',
  '0 * * * *',  -- 毎時0分
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-auto-engagement',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 2. auto-unfollow-scheduler（必須）

```sql
SELECT cron.schedule(
  'auto-unfollow-scheduler-hourly',
  '30 * * * *',  -- 毎時30分
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/auto-unfollow-scheduler',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  ) AS request_id;
  $$
);
```

## 使用シーン

### シーン1: 見込み客自動発掘

```json
{
  "rule_name": "副業関心層アプローチ",
  "rule_type": "keyword",
  "search_keywords": ["副業 始めたい", "在宅ワーク 探してる"],
  "exclude_keywords": ["詐欺", "怪しい"],
  "action_types": ["like", "follow"],
  "executor_account_ids": [/* 50スパムアカウント */],
  "max_accounts_per_run": 10,
  "min_followers": 100,
  "max_followers": 5000,
  "auto_unfollow_enabled": true,
  "unfollow_after_days": 3
}
```

実行結果:
- 1時間ごとに10アカウントで実行
- 1回あたり100件のいいね + 50件のフォロー
- 1日2400いいね + 1200フォロー
- 3日後に自動アンフォロー

### シーン2: 競合投稿へのアプローチ

```json
{
  "rule_name": "競合投稿への大量いいね",
  "rule_type": "url",
  "target_urls": ["https://twitter.com/competitor/status/123456"],
  "action_types": ["like", "reply"],
  "executor_account_ids": [/* 200スパムアカウント */],
  "reply_template_id": "uuid"
}
```

実行結果:
- 200アカウントから一斉にいいね
- リプライで自社PRを挿入
- 競合投稿を埋め込む

### シーン3: インフルエンサー監視

```json
{
  "rule_name": "インフルエンサー自動エンゲージメント",
  "rule_type": "user",
  "target_user_ids": ["123456789"],
  "action_types": ["like", "reply"],
  "executor_account_ids": [/* メインアカウント3個 */],
  "reply_template_id": "uuid"
}
```

実行結果:
- インフルエンサーの新規投稿を検知
- 投稿5分以内に自動いいね
- 好意的なリプライを送信

## レート制限対策

### Twitter API制限

**ユーザートークン（OAuth 2.0）**:
- いいね: 1000回/24時間
- フォロー: 400回/24時間
- リプライ: 300回/3時間
- RT: 制限なし

**App-only認証**:
- 検索: 180回/15分

### 実装上の対策

1. **バッチ処理**
   - 5トークン/バッチ
   - アクション間2秒待機
   - ルール間3秒待機

2. **アカウント分散**
   - 複数アカウントで負荷分散
   - max_accounts_per_run で制御
   - ランダム/シーケンシャル選択

3. **エラーハンドリング**
   - 429エラー時は自動スキップ
   - 次回実行時にリトライ
   - 通知送信

## 通知システム

### エンゲージメント完了通知

```typescript
{
  title: 'Auto-Engagement Completed',
  message: 'Rule "キーワード監視" executed: 45 actions, 42 successes',
  type: 'success',
  priority: 'low',
  category: 'execution'
}
```

### 自動アンフォロー通知

```typescript
{
  title: 'Auto-Unfollow Completed',
  message: 'Successfully unfollowed 80 user(s)',
  type: 'success',
  priority: 'low',
  category: 'execution'
}
```

### エラー通知

```typescript
{
  title: 'Auto-Unfollow Failed',
  message: 'Failed to unfollow 3 user(s)',
  type: 'warning',
  priority: 'medium',
  category: 'execution',
  metadata: { failures: [...] }
}
```

## セキュリティ

### アカウント保護

1. **メインアカウントは慎重に**
   - 1日50-100アクション以下
   - 高品質プロキシ使用
   - 手動承認推奨

2. **スパムアカウントは攻撃的に**
   - 1日500アクション
   - サスペンド前提
   - 使い捨て運用

3. **プロキシ必須**
   - スパムアカウントは1アカウント1プロキシ
   - メインアカウントも推奨

## デプロイ手順

```bash
# Edge Functions デプロイ
supabase functions deploy execute-auto-engagement
supabase functions deploy auto-unfollow-scheduler

# Cronジョブ設定（上記SQLを実行）

# 動作確認
curl -X POST \
  "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-auto-engagement" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "your-user-id"}'
```

## 次のステップ（Phase 4）

Phase 3完了後、以下を実装:

1. **UI実装**
   - エンゲージメントルール管理UI
   - 実行履歴表示
   - 通知センター

2. **プロキシ管理UI**
   - プロキシ割当UI
   - 健全性モニター

3. **分析ダッシュボード**
   - エンゲージメント統計
   - アカウントパフォーマンス

## ファイル一覧

```
supabase/functions/
├── execute-auto-engagement/
│   └── index.ts              # エンゲージメントルール実行
└── auto-unfollow-scheduler/
    └── index.ts              # 自動アンフォロースケジューラー
```

## まとめ

✅ **完了**: 2つのエンゲージメントEdge Functions実装
✅ **ルールタイプ**: キーワード/URL/ユーザー 3種類対応
✅ **アクション**: いいね/リプライ/フォロー/RT 4種類対応
✅ **自動アンフォロー**: スケジュール機能実装
✅ **レート制限対策**: バッチ処理・分散実行

**次の実装**: Phase 4 - UI実装 & プロキシ管理

---

**実装日**: 2025-11-12
**ステータス**: ✅ 完了
