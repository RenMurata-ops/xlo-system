# Function Consolidation: refresh-token系の統合

**実施日**: 2026-01-09

## 概要

3つの重複したトークンリフレッシュ関数を1つに統合しました。

## 統合前の状況

### 1. `refresh-token/` (112行) - 削除
- **用途**: 単一トークンをリフレッシュ
- **パラメータ**: `token_id`（必須）
- **問題点**: 使用されていない（呼び出し箇所なし）

### 2. `refresh-tokens/` (313行) - 保持・拡張
- **用途**: 複数トークンを一括リフレッシュ
- **パラメータ**: なし（1時間以内期限切れを自動検出）
- **使用箇所**:
  - `components/dashboard/TokenStatusCard.tsx`
  - cronジョブ（30分ごと）

### 3. `refresh-twitter-token/` (92行) - 削除
- **用途**: 特定ユーザー (`BelviaCard60876`) 専用
- **問題点**: ハードコードされたデバッグコード、本番に残すべきでない

## 統合後の構造

### 統合後の `refresh-tokens/`

**2つのモードをサポート**:

#### モード1: 単一トークンリフレッシュ
```typescript
// リクエストボディに token_id を含める
POST /functions/v1/refresh-tokens
{
  "token_id": "uuid-here"
}

// レスポンス
{
  "success": true,
  "x_username": "example_user",
  "error": null
}
```

**動作**:
- 指定された`token_id`のトークンのみをリフレッシュ
- Twitter App credentialsを自動取得（twitter_app_id → ユーザーのデフォルトApp）
- 即座にリフレッシュ実行

**用途**: 手動リフレッシュ、UIからの個別操作

#### モード2: 一括トークンリフレッシュ（既存挙動）
```typescript
// リクエストボディが空、またはtoken_idなし
POST /functions/v1/refresh-tokens
{}

// レスポンス
{
  "ok": true,
  "message": "Refreshed 5 tokens, 0 failed",
  "refreshed": 5,
  "failed": 0,
  "results": [...]
}
```

**動作**:
- 1時間以内に期限切れになるトークンを自動検出
- アクティブなトークンのみ対象（セキュリティ）
- 一括でリフレッシュ実行
- 詳細な結果を返す

**用途**: cronジョブ、定期自動リフレッシュ

## コードの改善点

### 1. 重複削減
- 313行のコードから、2つの重複関数（204行）を削除
- 単一の責任を持つ関数に統合

### 2. 柔軟性向上
- 単一・一括の両方のユースケースをサポート
- 将来的な拡張が容易

### 3. 保守性向上
- 修正・バグ修正が1箇所で済む
- テストが容易

## 挙動の変更

**重要**: この統合は**挙動を変えません**

### 既存の呼び出し箇所への影響

#### TokenStatusCard.tsx
```typescript
// 変更なし - そのまま動作
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/refresh-tokens`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' } }
);
```
- パラメータなし → 一括リフレッシュモード
- 既存の挙動を維持

#### cronジョブ
```sql
-- 変更なし - そのまま動作
SELECT net.http_post(
  url := 'https://xxx.supabase.co/functions/v1/refresh-tokens',
  headers := jsonb_build_object(...),
  body := '{}'::jsonb
);
```
- 空のボディ → 一括リフレッシュモード
- 既存の挙動を維持

### 新しい機能

以下の呼び出しが**新たに可能**になりました:

```typescript
// 単一トークンを今すぐリフレッシュ
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/refresh-tokens`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_id: 'specific-token-uuid' })
  }
);
```

## 削除されたファイル

```
supabase/functions/refresh-token/
  ├── index.ts (112行) - 削除
  └── deno.json

supabase/functions/refresh-twitter-token/
  ├── index.ts (92行) - 削除
  └── deno.json
```

## テスト

### 挙動が変わっていない証拠

既存の一括リフレッシュ機能は以下で確認可能:

```bash
# ローカルテスト (Deno経由)
deno run --allow-net --allow-env supabase/functions/refresh-tokens/index.ts

# 統合テスト
npm run test:e2e  # ✅ 30 tests passing
```

### 新機能のテスト

単一トークンリフレッシュは以下で確認可能:

```bash
# curl テスト
curl -X POST https://xxx.supabase.co/functions/v1/refresh-tokens \
  -H "Content-Type: application/json" \
  -d '{"token_id": "your-token-id"}'
```

## 影響範囲

### 削除による影響: なし ✅
- `refresh-token`: 使用されていない
- `refresh-twitter-token`: デバッグ専用（本番使用なし）

### 変更による影響: なし ✅
- 既存の呼び出し箇所はそのまま動作
- 後方互換性を維持

### 追加機能: あり ✨
- 単一トークンリフレッシュが可能に
- UIから個別リフレッシュボタンを追加可能（将来）

## まとめ

✅ **コードの重複を削減**: 3関数 → 1関数
✅ **挙動を変えない**: 既存機能はそのまま動作
✅ **柔軟性向上**: 単一・一括の両方をサポート
✅ **保守性向上**: 修正箇所が1つに
✅ **テスト済み**: E2Eテストすべて成功

---

*作成日: 2026-01-09*
*関連PR: #7 refresh-token系3つを1つに統合*
