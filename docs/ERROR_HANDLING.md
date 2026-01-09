# エラーハンドリングパターン統一 - Unified Error Handling

**実施日**: 2026-01-09

## 概要

Supabase Edge Functions用の統一されたエラーハンドリングシステムを導入しました。

従来のバラバラなエラー処理から、型安全で一貫性のあるエラーハンドリングに移行:
- ✅ 型安全なエラークラス
- ✅ 適切なHTTPステータスコード
- ✅ 構造化されたエラーレスポンス
- ✅ ロガーとの統合

## エラークラス

### 基本エラークラス

すべてのカスタムエラーは `AppError` を継承:

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### 利用可能なエラークラス

| クラス | HTTPステータス | 用途 |
|--------|---------------|------|
| `BadRequestError` | 400 | 無効な入力、必須パラメータ欠如 |
| `UnauthorizedError` | 401 | 認証が必要、トークン無効 |
| `ForbiddenError` | 403 | アクセス権限不足 |
| `NotFoundError` | 404 | リソースが見つからない |
| `ConflictError` | 409 | リソースの競合 |
| `ValidationError` | 422 | バリデーションエラー |
| `RateLimitError` | 429 | レート制限超過 |
| `InternalError` | 500 | サーバー内部エラー |
| `ExternalServiceError` | 502 | 外部サービスエラー |
| `ServiceUnavailableError` | 503 | サービス一時停止 |

## 使い方

### 基本的な使用方法

```typescript
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  handleError,
  assert,
} from '../_shared/errors.ts';
import { createLogger, getCorrelationId } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  const correlationId = getCorrelationId(req);
  const logger = createLogger('my-function', correlationId);

  try {
    // エラーを投げる
    const { user_id } = await req.json();

    if (!user_id) {
      throw new BadRequestError('Missing user_id');
    }

    // コンテキスト付きエラー
    throw new NotFoundError('User not found', { user_id });

    // ... 処理 ...

  } catch (error) {
    return handleError(error, logger);
  }
});
```

### assert()ヘルパー

条件チェックを簡潔に記述:

```typescript
// Before
if (!userId) {
  throw new BadRequestError('Missing user_id');
}

// After
assert(userId, new BadRequestError('Missing user_id'));
```

### withErrorHandling()ヘルパー

エラーハンドリングをラップ:

```typescript
return await withErrorHandling(async () => {
  // 処理
  const result = await doSomething();

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}, logger);
```

## エラーレスポンス形式

### 構造化されたJSON

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "context": {
      "user_id": "123"
    }
  }
}
```

HTTPレスポンス:
- `status`: 適切なHTTPステータスコード (400, 401, 404, 500...)
- `Content-Type`: `application/json`
- CORSヘッダー: 自動付与

### ロガーとの統合

エラーは自動的にログに記録:

```typescript
// 500エラー → logger.error()
// 400エラー → logger.warn()
```

ログ出力:
```json
{
  "level": "warn",
  "timestamp": "2026-01-09T08:15:30.123Z",
  "function": "twitter-oauth-start",
  "message": "Client error",
  "context": {
    "code": "BAD_REQUEST",
    "message": "Missing user_id",
    "statusCode": 400
  }
}
```

## 移行ガイド

### Before (従来のパターン)

```typescript
try {
  if (!userId) {
    throw new Error('Missing user_id');
  }

  const user = await getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // ...
} catch (error) {
  console.error('Error:', error);
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: 400 }  // すべて400
  );
}
```

**問題点**:
- ❌ エラー型が `any` または `unknown`
- ❌ HTTPステータスコードが不適切（すべて400）
- ❌ エラーレスポンス形式が不統一
- ❌ ログとレスポンスが別管理

### After (新しいパターン)

```typescript
import {
  BadRequestError,
  NotFoundError,
  handleError,
  assert,
} from '../_shared/errors.ts';
import { createLogger, getCorrelationId } from '../_shared/logger.ts';

const logger = createLogger('my-function', getCorrelationId(req));

try {
  assert(userId, new BadRequestError('Missing user_id'));

  const user = await getUser(userId);
  assert(user, new NotFoundError('User not found', { userId }));

  // ...
} catch (error) {
  return handleError(error, logger);
}
```

**改善点**:
- ✅ 型安全なエラークラス
- ✅ 適切なHTTPステータスコード（400, 404）
- ✅ 統一されたエラーレスポンス
- ✅ 自動ログ記録

## 実装例: twitter-oauth-start

完全に移行済みの関数を参照:

**ファイル**: `supabase/functions/twitter-oauth-start/index.ts`

```typescript
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  InternalError,
  handleError,
  assert,
} from '../_shared/errors.ts';
import { createLogger, getCorrelationId } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  const logger = createLogger('twitter-oauth-start', getCorrelationId(req));

  try {
    logger.info('OAuth start request received');

    // 認証チェック
    const authHeader = req.headers.get('Authorization');
    assert(authHeader, new UnauthorizedError('Missing authorization header'));

    // パラメータバリデーション
    const { account_id, account_type, twitter_app_id } = await req.json();
    assert(account_id, new BadRequestError('Missing account_id'));
    assert(account_type, new BadRequestError('Missing account_type'));

    // リソース存在チェック
    const { data: twitterApp, error: appError } = await supabase
      .from('twitter_apps')
      .select('*')
      .eq('id', twitter_app_id)
      .single();

    if (appError || !twitterApp) {
      throw new NotFoundError('Twitter App not found', { twitter_app_id });
    }

    // ... 処理 ...

    logger.info('OAuth URL generated successfully');
    return new Response(JSON.stringify({ authUrl }), { status: 200 });

  } catch (error) {
    return handleError(error, logger);
  }
});
```

## 移行状況

### ✅ 完了
- `_shared/errors.ts` - エラーハンドリングユーティリティ
- `twitter-oauth-start/` - 完全移行

### 🔄 今後の移行対象

優先順位順:

1. **認証関連**
   - `twitter-oauth-callback-v2/`
   - `twitter-api-proxy/`

2. **実行関連**
   - `execute-auto-engagement/`
   - `execute-loop/`
   - `execute-scheduled-posts/`

3. **その他の関数**
   - 残り19個のEdge Functions

## ベストプラクティス

### 1. 適切なエラークラスを使う

```typescript
// Good - 適切なエラークラス
assert(userId, new BadRequestError('Missing user_id'));
assert(user, new NotFoundError('User not found', { userId }));
assert(hasPermission, new ForbiddenError('Insufficient permissions'));

// Bad - 汎用エラー
if (!userId) throw new Error('Missing user_id');
```

### 2. コンテキストを含める

```typescript
// Good - デバッグ情報を含む
throw new NotFoundError('Twitter App not found', {
  twitter_app_id,
  user_id,
});

// Bad - コンテキストなし
throw new NotFoundError('Twitter App not found');
```

### 3. センシティブ情報を含めない

```typescript
// Bad - パスワードを含めない
throw new UnauthorizedError('Auth failed', { password });

// Good
throw new UnauthorizedError('Auth failed', { email });
```

### 4. handleError()を必ず使う

```typescript
// Good
} catch (error) {
  return handleError(error, logger);
}

// Bad - 手動レスポンス作成
} catch (error) {
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: 500 }
  );
}
```

## エラーコード一覧

| コード | 説明 |
|--------|------|
| `BAD_REQUEST` | 無効なリクエスト |
| `UNAUTHORIZED` | 認証が必要 |
| `FORBIDDEN` | アクセス権限不足 |
| `NOT_FOUND` | リソースが見つからない |
| `CONFLICT` | リソースの競合 |
| `VALIDATION_ERROR` | バリデーションエラー |
| `RATE_LIMIT_EXCEEDED` | レート制限超過 |
| `INTERNAL_ERROR` | 内部エラー |
| `EXTERNAL_SERVICE_ERROR` | 外部サービスエラー |
| `SERVICE_UNAVAILABLE` | サービス一時停止 |
| `UNKNOWN_ERROR` | 不明なエラー |

## メリット

### 1. 型安全性

TypeScriptの型チェックでエラーの網羅性を保証:

```typescript
try {
  // ...
} catch (error) {
  // error は unknown型として安全に扱われる
  return handleError(error, logger);
}
```

### 2. HTTPステータスコードの適切化

各エラーに適したステータスコードが自動設定:
- `BadRequestError` → 400
- `UnauthorizedError` → 401
- `NotFoundError` → 404
- `InternalError` → 500

### 3. デバッグの効率化

構造化されたコンテキストで問題特定が容易:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Twitter App not found",
    "context": {
      "twitter_app_id": "abc-123",
      "user_id": "user-456"
    }
  }
}
```

### 4. 一貫性

すべてのEdge Functionsで同じエラー形式:
- APIクライアントが統一的に処理可能
- エラーハンドリングのドキュメント化が容易

## まとめ

✅ **導入完了**: 統一エラーハンドリング (`_shared/errors.ts`)
✅ **実装例**: twitter-oauth-start関数で完全移行
✅ **型安全**: TypeScriptの型システムを活用
✅ **自動ログ**: handleError()でログ自動記録
🔄 **次のステップ**: 他の関数への段階的適用

統一されたエラーハンドリングにより、本番環境での問題調査とAPIクライアントの実装が大幅に簡素化されます。

---

*作成日: 2026-01-09*
*関連PR: #9 エラーハンドリングパターン統一*
