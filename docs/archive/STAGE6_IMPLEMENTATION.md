# Stage6 Implementation - Auto Engagement Rules

## 完了内容

### Migration & Edge Functions

✅ **20251116_auto_engagement.sql**
- `auto_engagement_rules` テーブル（自動エンゲージメントルール）
- `auto_engagement_executions` テーブル（実行ログ）
- Helper Functions:
  - `reset_daily_engagement_limits()` - 日次リミットリセット
  - `get_pending_engagement_rules()` - 実行待ちルール取得
  - `update_engagement_rule_stats()` - ルール統計更新
- Views:
  - `v_active_engagement_rules` - アクティブなルール一覧
  - `v_recent_engagement_executions` - 最近の実行履歴
  - `v_engagement_daily_stats` - 日次統計

✅ **execute-auto-engagement Edge Function**
- Twitter検索（keyword, hashtag, user）
- フィルタリング（フォロワー数、アカウント年齢、除外キーワード）
- アクション実行（like, reply, retweet, follow, quote）
- テンプレート統合（重み付きランダム選択）
- 実行ログ記録（trace_id付き）
- Cron自動実行（15分間隔）

---

## 📋 残りの実装タスク

### 1. UI実装（Priority: High）

#### `/engagement` ページ完全実装

**ファイル**: `app/engagement/page.tsx`

**必要な機能**:
- ✅ 基本レイアウト（既存）
- ❌ ルール作成・編集フォーム（新スキーマ対応）
  - search_type, search_query
  - action_type, reply_template_id
  - フィルター設定（min_followers, exclude_keywords）
  - 実行設定（executor_account_ids, max_actions_per_execution）
  - 日次リミット設定
- ❌ ルールカード表示
  - ステータス（アクティブ/非アクティブ）
  - 今日の実行数 / 日次リミット
  - 成功率表示
  - 次回実行時刻
- ❌ 「今すぐ実行」ボタン
  - Edge Function呼び出し
  - リアルタイム進捗表示
- ❌ 実行履歴タブ
  - `v_recent_engagement_executions` ビュー表示
  - trace_id表示
  - エラー詳細

**参考実装**:
```typescript
// Rule Form Example
const handleCreateRule = async (ruleData: any) => {
  const { error } = await supabase
    .from('auto_engagement_rules')
    .insert({
      user_id: userId,
      name: ruleData.name,
      search_type: ruleData.searchType,
      search_query: ruleData.searchQuery,
      action_type: ruleData.actionType,
      reply_template_id: ruleData.replyTemplateId,
      min_followers: ruleData.minFollowers,
      max_followers: ruleData.maxFollowers,
      exclude_keywords: ruleData.excludeKeywords,
      executor_account_ids: ruleData.executorAccountIds,
      max_actions_per_execution: ruleData.maxActions,
      daily_limit: ruleData.dailyLimit,
      execution_interval_hours: ruleData.intervalHours,
    });

  if (!error) {
    await loadRules();
  }
};

// Manual Execution Example
const handleExecuteNow = async (ruleId: string) => {
  const { data, error } = await supabase.functions.invoke('execute-auto-engagement', {
    body: { rule_id: ruleId },
  });

  if (data) {
    console.log('Execution result:', data);
    await loadRules(); // Refresh stats
  }
};
```

---

### 2. ダッシュボード強化（Priority: High）

#### リアルタイムレート制限モニター

**ファイル**: `app/dashboard/page.tsx`

**追加機能**:
```typescript
// Rate Limit Monitor Component
const RateLimitMonitor = () => {
  const [rateLimits, setRateLimits] = useState([]);

  useEffect(() => {
    const loadRateLimits = async () => {
      const { data } = await supabase
        .from('v_rate_limit_warnings')
        .select('*');

      setRateLimits(data || []);
    };

    loadRateLimits();
    const interval = setInterval(loadRateLimits, 60000); // 1分ごと
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>レート制限モニター</CardTitle>
      </CardHeader>
      <CardContent>
        {rateLimits.map(limit => (
          <div key={limit.id} className="flex justify-between items-center mb-2">
            <span>{limit.endpoint}</span>
            <Badge variant={limit.is_warning ? 'destructive' : 'default'}>
              {limit.remaining} / {limit.limit_total}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
```

#### ループロック状態表示
```typescript
// Active Loop Locks Component
const { data: activeLocks } = await supabase
  .from('v_active_loop_locks')
  .select('*');
```

#### 重複エラー表示
```typescript
// Recent Duplicates Component
const { data: duplicates } = await supabase
  .from('v_recent_duplicate_attempts')
  .select('*');
```

---

### 3. エラー通知システム（Priority: Medium）

#### トースト通知（重複/ロック/レート制限）

**インストール**: `npm install sonner` (既にインストール済み)

**実装例**:
```typescript
import { toast } from 'sonner';

// 重複エラー通知
if (error.message.includes('Duplicate post within 24h')) {
  toast.error('重複投稿エラー', {
    description: '24時間以内に同じ内容の投稿が存在します',
    action: {
      label: 'trace_idを表示',
      onClick: () => console.log(traceId),
    },
  });
}

// レート制限警告
if (rateLimits.is_warning) {
  toast.warning('レート制限警告', {
    description: `残り ${rateLimits.remaining_percent}%`,
  });
}

// ロックエラー
if (error.message.includes('Loop is locked')) {
  toast.info('ループ実行中', {
    description: 'このループは現在実行中です',
  });
}
```

---

### 4. テンプレート管理UI強化（Priority: Medium）

#### `/templates` ページ改善

**追加機能**:
- テンプレートプレビュー機能
- テンプレートアイテム編集UI
  - 重み（weight）のスライダー
  - ドラッグ&ドロップ並べ替え
- 使用統計グラフ（usage_count）
- CTAテンプレート管理

**参考ライブラリ**:
- `react-beautiful-dnd` - ドラッグ&ドロップ
- `recharts` - グラフ表示（既にインストール済み）

---

### 5. アカウント管理強化（Priority: Medium）

#### CSV一括インポート

```typescript
const handleCSVUpload = async (file: File) => {
  const text = await file.text();
  const rows = text.split('\n').slice(1); // Skip header

  const accounts = rows.map(row => {
    const [username, password, email] = row.split(',');
    return { username, password, email };
  });

  const { error } = await supabase
    .from('main_accounts')
    .insert(accounts);
};
```

#### アカウントヘルスチェック

```typescript
const checkAccountHealth = async (accountId: string) => {
  const { data } = await supabase.functions.invoke('twitter-api-proxy', {
    body: {
      endpoint: '/2/users/me',
      method: 'GET',
      account_id: accountId,
    },
  });

  return data.success;
};
```

---

### 6. 投稿管理UI強化（Priority: Low）

- 投稿スケジューリング（日時指定）
- 投稿プレビュー
- 下書き保存
- 投稿分析（エンゲージメント率）
- スレッド投稿対応

---

### 7. NordVPN統合（Priority: Low）

#### プロキシ自動割当

```sql
-- Function: get_available_proxy()
CREATE OR REPLACE FUNCTION get_available_proxy(p_strategy TEXT DEFAULT 'round_robin')
RETURNS proxies AS $$
DECLARE
  v_proxy proxies;
BEGIN
  IF p_strategy = 'round_robin' THEN
    SELECT * INTO v_proxy
    FROM proxies
    WHERE is_active = true
      AND (failure_count < 10 OR failure_count IS NULL)
    ORDER BY last_used_at ASC NULLS FIRST
    LIMIT 1;

    UPDATE proxies SET last_used_at = NOW() WHERE id = v_proxy.id;
  ELSIF p_strategy = 'random' THEN
    SELECT * INTO v_proxy
    FROM proxies
    WHERE is_active = true
      AND (failure_count < 10 OR failure_count IS NULL)
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  RETURN v_proxy;
END;
$$ LANGUAGE plpgsql;
```

---

## デプロイ手順

### 1. Supabaseマイグレーション適用

```bash
# Dashboard SQL Editor で実行
cat supabase/migrations/20251116_auto_engagement.sql
# または
supabase db push
```

### 2. Edge Functions デプロイ

```bash
cd ~/Downloads/xlo-system

# 新しいFunction
supabase functions deploy execute-auto-engagement

# 既存Functionsも再デプロイ（Cron更新反映）
supabase functions deploy schedule-loop-execution
supabase functions deploy execute-loop
supabase functions deploy execute-bulk-posts
supabase functions deploy twitter-api-proxy
supabase functions deploy twitter-oauth-start
supabase functions deploy twitter-oauth-callback-v2
```

### 3. Vercelデプロイ

```bash
cd ~/Downloads/xlo-system

# ビルドテスト
npm run build

# デプロイ
vercel --prod --yes
```

---

## 検証チェックリスト

### ✅ データベース

```sql
-- テーブル確認
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='auto_engagement_rules') as rules_exists,
       EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='auto_engagement_executions') as executions_exists;

-- Functions確認
SELECT proname FROM pg_proc WHERE proname LIKE '%engagement%';

-- Views確認
SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname LIKE '%engagement%';
```

### ✅ Edge Functions

```bash
# execute-auto-engagement テスト
curl -X POST \
  "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-auto-engagement" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" | jq .
```

---

## 次のステップ（優先度順）

1. **最優先**: `/engagement` UI実装
2. **高**: ダッシュボード強化
3. **中**: エラー通知システム
4. **中**: テンプレート管理UI
5. **低**: アカウント管理強化
6. **低**: 投稿管理UI
7. **低**: NordVPN統合

---

## コミット履歴

```bash
a28b64e - feat: Stage6 - Auto Engagement Rules implementation
```

---

## 参考リンク

- Twitter API v2 Docs: https://developer.twitter.com/en/docs/twitter-api
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Next.js 15: https://nextjs.org/docs
