# 構造化ロギング - Structured Logging

**実施日**: 2026-01-09

## 概要

Supabase Edge Functions用の構造化ロギングシステムを導入しました。

従来の`console.log()`から、構造化された JSON ログに移行することで:
- ✅ ログの検索性向上
- ✅ 相関IDによるリクエスト追跡
- ✅ ログレベルによるフィルタリング
- ✅ 構造化されたコンテキスト情報

## 使い方

### 基本的な使用方法

```typescript
import { createLogger, getCorrelationId } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  const correlationId = getCorrelationId(req);
  const logger = createLogger('my-function', correlationId);

  logger.info('Processing request', { userId: '123' });
  logger.error('Failed to process', { error: 'Network timeout' });
});
```

### ログレベル

```typescript
logger.debug('Detailed debug info', { data: complexObject });
logger.info('Normal operation', { status: 'success' });
logger.warn('Potential issue', { retries: 3 });
logger.error('Error occurred', { error: err.message });
```

### コンテキスト付きロガー

```typescript
// ベースコンテキストを持つロガーを作成
const userLogger = logger.withContext({ userId: '123', tenant: 'acme' });

// すべてのログにコンテキストが含まれる
userLogger.info('User action');
// → { userId: '123', tenant: 'acme', message: 'User action' }
```

## ログ出力形式

### 構造化されたJSON

```json
{
  "level": "info",
  "timestamp": "2026-01-09T08:15:30.123Z",
  "function": "refresh-tokens",
  "message": "Token refresh complete",
  "context": {
    "successful": 5,
    "failed": 0
  },
  "correlationId": "abc123-def456"
}
```

### 相関ID

リクエストヘッダーから自動抽出:
- `x-correlation-id`
- `x-request-id`
- なければUUIDを自動生成

同じリクエストに関連するすべてのログに同じIDが付与されます。

## 環境変数による制御

### LOG_LEVEL

ログレベルを環境変数で制御できます:

```bash
# 本番環境（infoレベル以上のみ）
LOG_LEVEL=info

# 開発環境（すべてのログ）
LOG_LEVEL=debug

# エラーのみ
LOG_LEVEL=error
```

**デフォルト**: `info`

## 移行ガイド

### Before (console.log)

```typescript
console.log('Processing user:', userId);
console.error('Error:', error);
console.log(`Found ${count} items`);
```

### After (structured logger)

```typescript
logger.info('Processing user', { userId });
logger.error('Error occurred', { error: error.message });
logger.info('Found items', { count });
```

### ❌ 避けるべきパターン

```typescript
// NG: 文字列補完を使わない
logger.info(`User ${userId} logged in`);

// OK: 構造化データとして渡す
logger.info('User logged in', { userId });
```

```typescript
// NG: エラーオブジェクトをそのまま渡さない
logger.error('Failed', { error });

// OK: エラーメッセージを渡す
logger.error('Failed', { error: error.message, stack: error.stack });
```

## 実装例: refresh-tokens

完全に移行済みの関数を参照:

**ファイル**: `supabase/functions/refresh-tokens/index.ts`

```typescript
import { createLogger, getCorrelationId } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  const correlationId = getCorrelationId(req);
  const logger = createLogger('refresh-tokens', correlationId);

  try {
    logger.info('Bulk token refresh started');

    // ... processing ...

    logger.info('Token refresh complete', { successful, failed });
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
  }
});
```

## 移行状況

### ✅ 完了
- `_shared/logger.ts` - ロギングユーティリティ
- `refresh-tokens/` - 完全移行（0 console.log残存）

### 🔄 今後の移行対象

優先順位順:

1. **高頻度実行関数**
   - `execute-auto-engagement/`
   - `execute-loop/`
   - `execute-scheduled-posts/`

2. **エラーが多い関数**
   - `twitter-oauth-callback-v2/`
   - `twitter-api-proxy/`

3. **その他の関数**
   - 残り21個のEdge Functions

4. **フロントエンド**
   - Components (208箇所)
   - App (318箇所)
   - 段階的に移行を検討

## メリット

### 検索性の向上

```bash
# 特定のユーザーのログを検索
jq 'select(.context.userId == "123")' logs.json

# エラーのみ表示
jq 'select(.level == "error")' logs.json

# 特定の時間範囲
jq 'select(.timestamp > "2026-01-09T08:00:00Z")' logs.json
```

### リクエスト追跡

correlation IDで1つのリクエストに関連するすべてのログを追跡:

```bash
jq 'select(.correlationId == "abc123")' logs.json
```

### デバッグの効率化

構造化されたコンテキストにより、問題の特定が容易に:

```json
{
  "level": "error",
  "message": "Token refresh failed",
  "context": {
    "x_username": "user123",
    "status": 401,
    "error": "Unauthorized"
  }
}
```

## パフォーマンス

### オーバーヘッド

- ログレベルチェックによる早期リターン
- JSON.stringify()のみの軽量処理
- 実測: < 1ms / ログエントリ

### ログボリューム削減

LOG_LEVELを本番環境で`info`に設定することで、debug ログを出力せず、ストレージコストを削減。

## ベストプラクティス

### 1. 構造化データを使う

```typescript
// Good
logger.info('Order created', { orderId, amount, currency });

// Bad
logger.info(`Order ${orderId} created for ${amount} ${currency}`);
```

### 2. エラーは常にcontextに含める

```typescript
try {
  // ...
} catch (error) {
  logger.error('Operation failed', {
    operation: 'processOrder',
    error: error.message,
    stack: error.stack,
  });
}
```

### 3. センシティブ情報を含めない

```typescript
// Bad - パスワードをログに含めない
logger.info('User login', { email, password });

// Good
logger.info('User login', { email });
```

### 4. 意味のあるメッセージを使う

```typescript
// Bad
logger.info('Done');

// Good
logger.info('Token refresh complete', { count: 5 });
```

## まとめ

✅ **導入完了**: 構造化ロガー (`_shared/logger.ts`)
✅ **実装例**: refresh-tokens関数で完全移行
✅ **ガイドライン**: 移行パターン確立
🔄 **次のステップ**: 他の関数への段階的適用

構造化ロギングにより、本番環境での問題調査が大幅に効率化されます。

---

*作成日: 2026-01-09*
*関連PR: #8 構造化ロギング導入*
