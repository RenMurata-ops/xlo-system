# 大量アカウント稼働ガイド

本システムで大量のアカウントを安全に運用するためのガイドです。

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
```

#### 健全性スコア計算:
- **成功リクエスト**: +2 ポイント（最大100）
- **失敗リクエスト**: -10 ポイント（最低0）
- **連続5回エラー**: 自動停止

### 2. レート制限管理

#### アカウント単位の制限:
- **Main Account**: 1日1000リクエスト
- **Spam Account**: 1日500リクエスト（より保守的）
- **Engagement**: 1日800リクエスト

#### 健全性チェック:
- リクエスト前に `can_account_make_request()` 関数で検証
- 健全性スコア < 20 → リクエスト拒否
- 日次制限超過 → リクエスト拒否
- is_active = false → リクエスト拒否

### 3. 詳細ロギング

すべてのリクエストが `account_request_log` テーブルに記録：

```sql
endpoint                -- APIエンドポイント
status_code            -- HTTPステータス
rate_limit_remaining   -- 残りレート制限
request_duration_ms    -- リクエスト時間
is_rate_limited        -- レート制限フラグ
is_error               -- エラーフラグ
proxy_id               -- 関連プロキシ（将来対応）
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

## 📊 大量稼働の推奨構成

### 小規模（5-20アカウント）
```
✅ 現状のまま使用可能
✅ プロキシなしで問題なし
✅ デフォルトのレート制限で十分
```

### 中規模（20-100アカウント）
```
⚠️ レート制限を監視
⚠️ 健全性スコアを定期確認
⚠️ エラー率を10%以下に維持
推奨: プロキシの導入検討
```

### 大規模（100+アカウント）
```
🔴 プロキシ必須
🔴 レート制限の厳密な管理
🔴 段階的なスケールアップ
🔴 24時間監視体制
```

---

## 🚀 ベストプラクティス

### 1. 段階的なスケールアップ

**推奨手順**:
```
週1: 5アカウントでテスト
週2: 10アカウントに増加
週3: 20アカウントに増加
週4: 50アカウントに増加
以降: 週ごとに2倍に増加
```

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

### 5. プロキシ準備（将来対応）

**現状**:
- プロキシ情報はDBに登録可能 ✅
- アカウント-プロキシの関連付け完了 ✅
- 実際のプロキシ経由リクエストは未実装 ⚠️

**プロキシ実装時の推奨**:
- 1プロキシあたり5-10アカウント
- プロキシのローテーション
- プロキシ健全性チェック

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
