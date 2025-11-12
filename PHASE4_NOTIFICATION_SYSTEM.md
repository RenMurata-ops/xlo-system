# Phase 4: Notification System Implementation

## 概要
リアルタイム通知システムの完全実装を完了しました。

## 実装内容

### 1. 通知コンポーネント

#### NotificationCenter (`components/notifications/NotificationCenter.tsx`)
ヘッダーに表示される通知センターコンポーネント：
- ベルアイコンと未読数バッジ
- Supabase Realtimeによるリアルタイム通知受信
- ドロップダウンパネルで最新50件の通知を表示
- 既読マーク・削除機能
- ブラウザ通知サポート（権限取得済みの場合）
- 通知タイプ（info/success/warning/error）による色分け
- 優先度（urgent）の視覚的強調

**主要機能：**
```typescript
// Realtimeサブスクリプション
function subscribeToNotifications() {
  const channel = supabase
    .channel('notifications')
    .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      },
      (payload) => {
        const newNotification = payload.new as Notification;
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);

        // ブラウザ通知
        if (Notification.permission === 'granted') {
          new Notification(newNotification.title, {
            body: newNotification.message,
            icon: '/icon.png',
          });
        }
      }
    )
    .subscribe();
}
```

#### NotificationToast (`components/notifications/NotificationToast.tsx`)
高優先度通知用のトースト表示：
- high/urgent優先度の通知のみ表示
- 自動消去（urgent: 10秒、high: 5秒）
- 右上からスライドインアニメーション
- タイプ別の色分けとアイコン
- 手動閉じるボタン

#### Notifications Page (`app/notifications/page.tsx`)
通知一覧ページ：
- 全通知の表示・管理
- フィルタリング機能：
  - 既読/未読フィルタ
  - カテゴリフィルタ（system/account/execution/rate_limit）
- 一括既読マーク
- 既読通知の一括削除
- 個別削除・既読マーク
- アクションボタン（action_url指定時）

### 2. レイアウト統合

#### Header Component (`components/layout/Header.tsx`)
新規作成されたヘッダーコンポーネント：
- 固定ヘッダー（sticky top-0）
- NotificationCenterの統合
- モバイルメニューボタン（lg未満画面）
- 将来の拡張用スペース（ユーザーメニュー等）

#### MainLayout Update (`components/layout/MainLayout.tsx`)
- Headerコンポーネントの追加
- レイアウト構造の改善

#### Root Layout Update (`app/layout.tsx`)
- NotificationToastの全ページ配置
- グローバルトースト表示の有効化

#### Sidebar Update (`components/layout/Sidebar.tsx`)
- 通知ページへのメニュー項目追加
- ダッシュボード直下に配置

### 3. データベース統合

通知システムは既存のPhase 1で実装済みの`notifications`テーブルを使用：

**Notifications Table:**
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info', -- info, success, warning, error
  priority text NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  category text NOT NULL DEFAULT 'system', -- system, account, execution, rate_limit
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  action_url text,
  action_label text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
```

### 4. Realtime Subscription Setup

**必要な設定（Supabase Dashboard）：**

1. **Replication有効化:**
```sql
-- notificationsテーブルのreplication有効化
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

2. **RLS設定確認:**
```sql
-- 既にPhase 1で実装済み
SELECT * FROM notifications WHERE user_id = auth.uid();
```

## 通知の送信方法

### Edge Functionから通知を送信

```typescript
// 例: Token refresh失敗通知
await supabase.from('notifications').insert({
  user_id: userId,
  title: 'Token Refresh Failed',
  message: `Failed to refresh token for @${username}`,
  type: 'error',
  priority: 'urgent',
  category: 'account',
  action_url: '/accounts/main',
  action_label: 'View Account',
  metadata: { account_id: accountId }
});
```

### クライアントから通知を送信

```typescript
// 例: 操作完了通知
const { error } = await supabase
  .from('notifications')
  .insert({
    user_id: user.id,
    title: 'Bulk Post Created',
    message: '100 posts scheduled successfully',
    type: 'success',
    priority: 'medium',
    category: 'execution',
  });
```

## 通知タイプと優先度

### Type（見た目の色分け）
- `info`: 青色 - 一般情報
- `success`: 緑色 - 成功メッセージ
- `warning`: 黄色 - 警告
- `error`: 赤色 - エラー

### Priority（表示方法）
- `low`: 通知センターのみ
- `medium`: 通知センターのみ
- `high`: 通知センター + トースト表示
- `urgent`: 通知センター + トースト表示（10秒間）+ 赤色強調

### Category（フィルタリング用）
- `system`: システム通知
- `account`: アカウント関連
- `execution`: 実行・処理関連
- `rate_limit`: レート制限関連

## 使用例

### 1. トークン更新失敗通知（Edge Function）
```typescript
// supabase/functions/auto-token-refresh/index.ts
await supabase.from('notifications').insert({
  user_id: token.user_id,
  title: 'Token Refresh Failed',
  message: `@${token.x_username} - Token could not be refreshed`,
  type: 'error',
  priority: 'urgent',
  category: 'account',
  action_url: '/accounts/main',
  action_label: 'Check Account'
});
```

### 2. レート制限警告（Edge Function）
```typescript
await supabase.from('notifications').insert({
  user_id: userId,
  title: 'Rate Limit Warning',
  message: 'Account approaching rate limit (90% used)',
  type: 'warning',
  priority: 'high',
  category: 'rate_limit',
  action_url: '/analytics',
  action_label: 'View Analytics'
});
```

### 3. 一括処理完了通知（クライアント）
```typescript
await supabase.from('notifications').insert({
  user_id: user.id,
  title: 'Bulk Operation Complete',
  message: '250 tweets processed successfully',
  type: 'success',
  priority: 'medium',
  category: 'execution'
});
```

## UI/UX 設計

### ヘッダー通知センター
- 常時表示のベルアイコン
- 未読数バッジ（99+まで表示）
- クリックでドロップダウン展開
- 最新50件を時系列で表示
- 「すべて既読」ボタン
- 「すべての通知を見る」リンク

### トースト通知
- 右上に固定表示
- 複数同時表示可能
- スライドインアニメーション
- 優先度に応じた自動消去
- 手動閉じるボタン

### 通知ページ
- フルページで全通知を管理
- 高度なフィルタリング
- 一括操作機能
- 詳細表示・アクション実行

## 実装済みのEdge Functions統合

以下のEdge Functionsから既に通知が送信されます：

1. **comprehensive-token-refresh** (`supabase/functions/comprehensive-token-refresh/index.ts:283-293`)
   - 無効・停止されたトークンの警告通知

2. **refresh-expired-tokens** (`supabase/functions/refresh-expired-tokens/index.ts:180-191`)
   - 期限切れトークンの更新失敗通知

これらの関数は既にPhase 2/3で実装済みで、通知システムと連携済みです。

## 今後の拡張予定

### Phase 5以降で追加予定：
- [ ] Email通知機能（Resend統合）
- [ ] Webhook通知（Discord/Slack）
- [ ] 通知設定ページ（ユーザーごとのカスタマイズ）
- [ ] 通知テンプレート管理
- [ ] 通知スケジューリング（遅延送信）
- [ ] 通知グループ化（同種の通知をまとめる）

## テスト方法

### 1. 手動テスト通知の送信（Supabase Dashboard）

```sql
-- テスト通知を挿入
INSERT INTO notifications (user_id, title, message, type, priority, category)
VALUES (
  '<your-user-id>',
  'Test Notification',
  'This is a test notification',
  'info',
  'high',
  'system'
);
```

### 2. Edge Functionからのテスト

```typescript
// Supabase Edge Function内でテスト
await supabase.from('notifications').insert({
  user_id: userId,
  title: 'Test from Edge Function',
  message: 'Testing notification system',
  type: 'success',
  priority: 'urgent',
  category: 'system'
});
```

### 3. フロントエンドからのテスト

通知ページ（`/notifications`）にアクセスして：
1. 通知が正しく表示されるか確認
2. フィルタリングが動作するか確認
3. 既読マーク・削除が動作するか確認
4. トースト表示が動作するか確認（high/urgentの場合）

## 完了項目

✅ NotificationCenterコンポーネント実装
✅ NotificationToastコンポーネント実装
✅ 通知一覧ページ実装
✅ Headerコンポーネント作成
✅ MainLayoutへの統合
✅ Sidebarへのメニュー追加
✅ Realtime subscriptionの実装
✅ 既存Edge Functions統合
✅ TypeScript型安全性確保
✅ ビルド検証

## 次のステップ

Phase 4の残りのUI実装に進みます：
1. プロキシ管理UI
2. エンゲージメントルール管理UI
3. アカウント管理UI強化
4. 分析ダッシュボード
5. レート制限監視UI
