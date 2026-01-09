# XLO System - 根本原因分析と修正手順

## 🔍 問題の根本原因（Root Cause）

### 特定された問題
トークンリフレッシュ機能の停止と広範囲な不具合が発生している。

### 根本原因
**マイグレーション適用の不完全性による系統的なスキーマ不整合**

#### 詳細説明

1. **初期スキーマ (20251110_initial_schema.sql)**
   - 基本的なテーブル構造のみを定義
   - 多くの列は後続のマイグレーションで追加される設計

2. **増分マイグレーション (29個のマイグレーションファイル)**
   - 後続のマイグレーションで `ALTER TABLE ADD COLUMN IF NOT EXISTS` を使用して列を追加
   - 例：`auto_engagement_rules` テーブルに20+個の列を段階的に追加

3. **本番環境での問題**
   - テーブルが初期スキーマで作成された後、一部のマイグレーションが適用されていない
   - `CREATE TABLE IF NOT EXISTS` は既存テーブルに列を追加しない
   - 結果：コードが参照する列が実際のDBに存在しない

4. **対症療法の繰り返し**
   - `auto_engagement_rules.allowed_account_tags` が無いとエラー → 追加
   - `auto_engagement_rules.daily_limit` が無いとエラー → 追加
   - しかし、他のテーブルにも同様の問題が存在

### 影響を受けるテーブル

1. **auto_engagement_rules** (最も深刻)
   - 初期スキーマ: 32列
   - 追加されるべき列: 20+列
   - 不足列の例：
     - `allowed_account_tags` (アカウントフィルタリング)
     - `daily_limit` (日次制限)
     - `action_types` (複数アクション対応)
     - `search_since/until` (高度な検索フィルタ)
     - 等々

2. **loops** (Post/Reply/CTA ループ)
   - 初期スキーマ: 基本構造のみ
   - 追加されるべき列：
     - `loop_type` (post/reply/cta)
     - `template_ids` (テンプレート配列)
     - `selection_mode` (random/sequential)
     - `execution_interval_minutes` (分単位実行間隔)
     - 等々

3. **posts**
   - 不足列：`in_reply_to_tweet_id` (Reply Loop用)

4. **templates**
   - テーブル自体が存在しない可能性

5. **account_tokens** (トークンリフレッシュ)
   - 全列が存在するはずだが、確認が必要
   - トークンリフレッシュ機能がこのテーブルに依存

---

## 🎯 根本的な解決策

### 方針
**全テーブルの全カラムを一括で追加し、完全なスキーマ整合性を確保する**

対症療法ではなく、予期されるすべてのスキーマ不整合を一度に修正。

---

## 📋 修正手順（3ステップ）

### ステップ 1: 現在のスキーマ状態を確認

Supabase Dashboard → SQL Editor で以下を実行：

```bash
COMPLETE_SCHEMA_VERIFICATION.sql
```

**目的**：
- 全テーブルの全カラムが存在するか確認
- 不足している列を特定
- 重要な機能に必要な列が揃っているか検証

**確認ポイント**：
- `MISSING: account_tokens` - トークンリフレッシュ用の列不足
- `MISSING: auto_engagement_rules` - エンゲージメント機能用の列不足
- `MISSING: loops` - ループ機能用の列不足
- `MISSING: posts` - 投稿機能用の列不足
- `templates table check` - テンプレートテーブルの存在確認

### ステップ 2: 全ての不足列を一括追加

Supabase Dashboard → SQL Editor で以下を実行：

```bash
COMPLETE_SCHEMA_FIX.sql
```

**このSQLが行うこと**：
1. `auto_engagement_rules` に全ての不足列を追加（20+列）
2. `loops` に全ての不足列を追加（10+列）
3. `posts` に `in_reply_to_tweet_id` を追加
4. `templates` テーブルを作成（存在しない場合）
5. `auto_engagement_executions` テーブルを作成（存在しない場合）
6. 全てのインデックス、制約、RLSポリシーを設定

**特徴**：
- ✅ 冪等性：何度実行しても安全（`IF NOT EXISTS` 使用）
- ✅ 完全性：全ての期待される列を追加
- ✅ 安全性：既存データを破壊しない

### ステップ 3: 修正後の検証

再度 `COMPLETE_SCHEMA_VERIFICATION.sql` を実行して確認：

```sql
-- 期待される結果：
-- ✅ All token refresh columns present
-- ✅ All engagement columns present
-- ✅ All loop columns present
-- ✅ templates table exists
-- ❌ の表示が全て無くなる
```

---

## 🧪 機能別の動作確認

### 1. トークンリフレッシュ機能

```bash
# Edge Function ログで確認
Supabase Dashboard → Edge Functions → refresh-tokens → Logs
```

**確認ポイント**：
- トークンが正常に更新されているか
- `account_tokens` テーブルの `last_refreshed_at` が更新されているか
- エラーログに `column does not exist` が無いか

### 2. Auto Engagement 機能

```bash
# テストルールを作成して実行
/engagement → 新規ルール作成 → 実行
```

**確認ポイント**：
- ルールが正常に保存できるか
- `allowed_account_tags`, `daily_limit` が正常に機能するか
- エンゲージメント実行が成功するか

### 3. Loop 機能（Post/Reply/CTA）

```bash
# 各タイプのループを作成してテスト
/loops → 新規作成 → 各タイプを選択 → 実行
```

**確認ポイント**：
- Post Loop: ランダム/順次選択が機能するか
- Reply Loop: リプライターゲットが正常に処理されるか
- CTA Loop: アカウント監視が機能するか

---

## 📊 修正前後の比較

| 項目 | 修正前 | 修正後 |
|-----|--------|--------|
| `auto_engagement_rules` 列数 | 不完全（32列程度） | 完全（50+列） |
| `loops` 列数 | 不完全（20列程度） | 完全（30+列） |
| `templates` テーブル | 存在しない可能性 | 確実に存在 |
| トークンリフレッシュ | ❌ 動作しない | ✅ 正常動作 |
| エンゲージメント機能 | ❌ エラー | ✅ 正常動作 |
| ループ機能 | ❌ 制限付き | ✅ 完全機能 |

---

## 🚀 今後の予防策

### 1. マイグレーション管理の改善
- 全てのマイグレーションが順次適用されることを確認
- `supabase db push` を使用して本番環境に確実に適用

### 2. スキーマ検証の自動化
- デプロイ時に `COMPLETE_SCHEMA_VERIFICATION.sql` を自動実行
- CI/CD に組み込む

### 3. 本番環境とdev環境の同期
- 定期的にスキーマの差分をチェック
- `supabase db diff` を活用

---

## 📞 問題が解決しない場合

以下を確認してください：

1. **COMPLETE_SCHEMA_FIX.sql の実行結果**
   - エラーメッセージがあるか
   - 全ての ALTER TABLE が成功したか

2. **Edge Functions のログ**
   - `column does not exist` エラーが残っていないか
   - 新しいエラーが発生していないか

3. **アプリケーションのコンソールログ**
   - フロントエンドでエラーが表示されていないか

---

## ✅ チェックリスト

実行前：
- [ ] Supabase Dashboard にアクセス可能
- [ ] SQL Editor を開く
- [ ] `COMPLETE_SCHEMA_VERIFICATION.sql` の内容をコピー

実行中：
- [ ] ステップ1: 検証SQL実行 → 結果を確認
- [ ] ステップ2: 修正SQL実行 → 完了を確認
- [ ] ステップ3: 再検証SQL実行 → 全て ✅ になることを確認

実行後：
- [ ] トークンリフレッシュ機能をテスト
- [ ] エンゲージメント機能をテスト
- [ ] ループ機能をテスト
- [ ] 全ての機能が正常動作することを確認

---

**所要時間**: 約10分
**難易度**: 簡単（SQLをコピー&実行するだけ）
**リスク**: 低（既存データは保持される、冪等性あり）
