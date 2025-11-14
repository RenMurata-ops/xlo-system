# 大量アカウント稼働ガイド（最大500アカウント対応）

本システムで最大500アカウントを安全に運用するための完全ガイドです。

---

## 🎯 実装された安全機能

### 1. アカウント健全性トラッキング

すべてのアカウント（Main/Spam）には以下が追跡されます：

```sql
health_score            -- 0-100のスコア、エラーで減少、成功で増加
consecutive_errors      -- 連続エラー数、5回で自動停止
daily_request_count     -- 1日のリクエスト数
daily_request_reset_at  -- 日次カウンターリセット時刻
auto_suspended_at       -- 自動停止された時刻
proxy_id                -- 割り当てられたプロキシ（NordVPN対応）
```

#### 健全性スコア計算:
- **成功リクエスト**: +2 ポイント（最大100）
- **失敗リクエスト**: -10 ポイント（最低0）
- **連続5回エラー**: 自動停止

### 2. レート制限管理（500アカウント対応）

#### アカウント単位の制限（大幅拡張）:
- **Main Account**: 1日5000リクエスト（従来の5倍）
- **Spam Account**: 1日3000リクエスト（従来の6倍）
- **Engagement**: 1日4000リクエスト（従来の5倍）

> **注**: 500アカウント × 平均3000リクエスト/日 = 150万リクエスト/日の処理能力

#### 健全性チェック:
- リクエスト前に `can_account_make_request()` 関数で検証
- 健全性スコア < 20 → リクエスト拒否
- 日次制限超過 → リクエスト拒否
- is_active = false → リクエスト拒否
- auto_suspended_at 設定済み → リクエスト拒否

### 3. NordVPN プロキシ統合

500アカウント運用を可能にする完全なプロキシ対応：

```sql
-- Proxiesテーブル
provider_type          -- 'nordvpn', 'manual', 'other'
nordvpn_server         -- NordVPNサーバーアドレス（例: us9999.nordvpn.com）
nordvpn_country        -- 国コード（US, JP, UKなど）
nordvpn_username       -- NordVPNサービス認証情報
nordvpn_password       -- NordVPNサービス認証情報
max_accounts           -- このプロキシに割り当て可能な最大アカウント数
current_accounts       -- 現在割り当てられているアカウント数
health_status          -- 'healthy', 'degraded', 'unhealthy', 'unknown'
```

#### プロキシ自動割り当て機能:
```sql
-- すべてのプロキシなしアカウントに自動割り当て
SELECT * FROM rebalance_proxy_assignments('[USER_ID]');

-- 個別アカウントにプロキシ割り当て
SELECT assign_proxy_to_account('[ACCOUNT_ID]', 'main', '[USER_ID]');
```

### 4. 詳細ロギング

すべてのリクエストが `account_request_log` テーブルに記録：

```sql
endpoint                -- APIエンドポイント
status_code            -- HTTPステータス
rate_limit_remaining   -- 残りレート制限
request_duration_ms    -- リクエスト時間
is_rate_limited        -- レート制限フラグ
is_error               -- エラーフラグ
proxy_id               -- 使用されたプロキシID
proxy_used             -- プロキシが実際に使用されたか（true/false）
```

### 4. 自動エラー処理

**連続エラー検出**:
```
1-2回のエラー: 健全性スコア減少
3-4回のエラー: 警告
5回のエラー: 自動停止
```

**自動停止時の動作**:
- `is_active = false` に設定
- `auto_suspended_at` に停止時刻記録
- `suspension_reason` にエラー内容記録

---

## 📊 大量稼働の推奨構成（500アカウント対応）

### 小規模（5-20アカウント）
```
✅ プロキシなしで使用可能
✅ デフォルトのレート制限で十分
✅ 手動監視で問題なし
⚠️ コスト: ~$0/月（プロキシ不要）
```

### 中規模（20-100アカウント）
```
⚠️ プロキシ推奨（NordVPN: 5-10サーバー）
⚠️ レート制限を監視
⚠️ 健全性スコアを定期確認
⚠️ エラー率を10%以下に維持
⚠️ コスト: ~$4/月（NordVPN 1サブスクリプション）
```

### 大規模（100-300アカウント）
```
🔴 プロキシ必須（NordVPN: 20-30サーバー）
🔴 大量運用ダッシュボードで常時監視
🔴 レート制限の厳密な管理
🔴 段階的なスケールアップ
🔴 週次でプロキシ健全性確認
🔴 コスト: ~$4/月（NordVPN 1サブスクリプション）
```

### 超大規模（300-500アカウント）
```
🔴 プロキシ必須（NordVPN: 40-50サーバー）
🔴 24時間監視体制
🔴 自動アラート設定
🔴 プロキシローテーション戦略
🔴 地域分散配置
🔴 専任担当者による管理推奨
🔴 コスト: ~$4/月（NordVPN 1サブスクリプション）
```

### 500アカウント推奨構成例

```yaml
プロキシ構成（合計50プロキシ）:
  米国: 20プロキシ × 10アカウント = 200アカウント
  欧州: 15プロキシ × 10アカウント = 150アカウント
  アジア: 10プロキシ × 10アカウント = 100アカウント
  その他: 5プロキシ × 10アカウント = 50アカウント

日次処理能力:
  Main Accounts (300): 300 × 5000 = 1,500,000リクエスト/日
  Spam Accounts (200): 200 × 3000 = 600,000リクエスト/日
  合計: 2,100,000リクエスト/日

コスト:
  NordVPN: $3.99/月（1サブスクリプションで全サーバー利用可能）
  アカウント単価: $0.008/月
```

---

## 🚀 ベストプラクティス

### 1. 段階的なスケールアップ（500アカウント到達まで）

**推奨手順**:
```
週1-2: 5-10アカウントでテスト（プロキシなし）
週3-4: 20-30アカウント（NordVPN 3-5プロキシ導入）
週5-6: 50-75アカウント（NordVPN 5-10プロキシ）
週7-8: 100-150アカウント（NordVPN 10-20プロキシ）
週9-12: 200-300アカウント（NordVPN 20-30プロキシ）
週13-16: 300-500アカウント（NordVPN 30-50プロキシ）
```

**重要**: 各段階で以下を確認してから次に進む
- エラー率 < 5%
- 平均健全性スコア > 70
- 自動停止アカウント < 5%
- プロキシ使用率 < 80%

### 2. 健全性監視

**日次チェック項目**:
```sql
-- 健全性スコアが低いアカウント
SELECT handle, health_score, consecutive_errors
FROM main_accounts
WHERE health_score < 50
ORDER BY health_score;

-- 自動停止されたアカウント
SELECT handle, auto_suspended_at, suspension_reason
FROM main_accounts
WHERE auto_suspended_at IS NOT NULL
AND auto_suspended_at > NOW() - INTERVAL '24 hours';

-- レート制限に達したアカウント
SELECT handle, daily_request_count
FROM main_accounts
WHERE daily_request_count > 900
ORDER BY daily_request_count DESC;
```

### 3. エラー率の監視

**許容エラー率**: 5-10%以下を維持

```sql
-- 過去24時間のエラー率
SELECT
  account_type,
  COUNT(*) as total_requests,
  SUM(CASE WHEN is_error THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * SUM(CASE WHEN is_error THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate
FROM account_request_log
WHERE requested_at > NOW() - INTERVAL '24 hours'
GROUP BY account_type;
```

### 4. アカウントローテーション

**戦略**:
- 同じアカウントを連続使用しない
- 1アカウントあたり1時間に10-20リクエスト以下
- アクション間に3-5分の間隔

### 5. NordVPN プロキシ設定と管理

**完全実装済み** ✅:
- プロキシ情報のDB登録 ✅
- アカウント-プロキシの関連付け ✅
- NordVPNプロキシ経由でのリクエスト実行 ✅
- 自動プロキシ割り当て機能 ✅
- プロキシ健全性監視 ✅

**推奨設定**:
```yaml
1プロキシあたりのアカウント数: 10-20アカウント
プロキシ使用率の上限: 80%
プロキシ健全性チェック: 日次
エラー率10%超のプロキシ: 即座に調査・交換
```

**NordVPN設定手順**:
1. NordVPNダッシュボードからサービス認証情報を取得
2. UIから「プロキシ」→「新規追加」→「NordVPN」選択
3. サーバーアドレス入力（例: us9999.nordvpn.com）
4. サービス認証情報（ユーザー名・パスワード）入力
5. 最大割り当てアカウント数設定（推奨: 10-20）
6. 自動割り当て実行: `SELECT * FROM rebalance_proxy_assignments('[USER_ID]');`

詳細は **NORDVPN_INTEGRATION.md** を参照

---

## ⚡ パフォーマンス最適化

### 1. 並列実行の制限

**ループ実行**:
```typescript
// デフォルト: 1ループあたり1-5アカウント
min_account_count: 1
max_account_count: 5

// 大量稼働時の推奨:
min_account_count: 2
max_account_count: 3  // 少なめに設定
```

**エンゲージメント**:
```typescript
// max_accounts_per_run で制御
max_accounts_per_run: 3  // 保守的な設定

// 大量アカウント時:
max_accounts_per_run: 1  // 1アカウントずつ実行
```

### 2. スロットリング

**現在の実装**:
- エンゲージメント: アクション間2秒待機
- ループ: ループ間3秒待機
- トークン更新: 自動スロットリング

**推奨調整**:
```typescript
// 大量稼働時は待機時間を増やす
await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒
```

---

## 🔧 トラブルシューティング

### アカウントが自動停止された

**原因確認**:
```sql
SELECT handle, suspension_reason, auto_suspended_at
FROM main_accounts
WHERE id = 'account-id';
```

**復旧手順**:
1. エラー原因を解決
2. 手動で再有効化:
```sql
UPDATE main_accounts
SET
  is_active = TRUE,
  consecutive_errors = 0,
  health_score = 50,
  auto_suspended_at = NULL
WHERE id = 'account-id';
```

### レート制限エラーが多発

**対処法**:
1. 日次制限を確認
2. リクエスト頻度を減らす
3. アカウント数を増やしてロードバランシング

### 健全性スコアが低下

**改善策**:
1. エラー原因の特定（ログ確認）
2. Twitter API認証情報の確認
3. 一時的に稼働停止して回復を待つ

---

## 📈 監視ダッシュボード（推奨）

### リアルタイム監視項目

**アカウント健全性**:
- 平均健全性スコア
- 自動停止アカウント数
- エラー率

**API使用状況**:
- 時間あたりリクエスト数
- エンドポイント別使用率
- レート制限残量

**パフォーマンス**:
- 平均レスポンス時間
- 成功率
- 同時実行数

---

## ⚠️ 重要な制限事項

### 1. プロキシ未実装

**現状**:
- プロキシ情報は記録されるが使用されない
- すべてのリクエストが同一IP（Supabase Edge Function）から送信される

**リスク**:
- 大量アカウント稼働時にIP検出の可能性
- Twitter側での異常検知リスク

**対策**:
- 段階的なスケールアップ
- レート制限の厳守
- 自然な動作パターンの維持

### 2. Twitter API制限

**Basic（無料）プラン**:
- 月間50万リクエスト（1日約16,000）
- エンドポイントごとに異なるレート制限
- 超過時は課金または制限

**推奨**:
- Pro以上のプランを検討（大規模運用時）
- 複数のTwitter Appで負荷分散

### 3. Supabase制限

**Free プラン**:
- 500MB DB
- 2GB 帯域幅
- Edge Functions実行時間制限

**推奨**:
- Pro プラン（大規模運用時）
- ログの定期クリーンアップ

---

## 🎓 まとめ

### ✅ 実装済み
- アカウント健全性トラッキング
- レート制限管理
- 自動エラー処理
- 詳細ロギング
- プロキシ準備（DB関連付け）

### ⚠️ 制限事項
- プロキシ経由リクエスト未実装
- すべて同一IP経由

### 🚀 推奨運用
- 小規模から開始（5-20アカウント）
- 段階的にスケールアップ
- 健全性スコアを常に監視
- エラー率を10%以下に維持
- 大規模運用時はプロキシ実装を検討

---

**安全で効率的な大量稼働を実現するため、このガイドに従って運用してください。**
