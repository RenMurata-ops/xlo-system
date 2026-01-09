# テスト戦略

XLO Systemは、Vitest（ユニットテスト）とPlaywright（E2Eテスト）を使用したテスト戦略を採用しています。

## テスト実行

### ユニットテスト（Vitest）

```bash
# テスト実行
npm run test

# ウォッチモード
npm run test -- --watch

# UIモード
npm run test:ui

# カバレッジレポート
npm run test:coverage
```

### E2Eテスト（Playwright）

```bash
# すべてのE2Eテストを実行
npm run test:e2e

# UIモード（インタラクティブ）
npm run test:e2e:ui

# デバッグモード
npm run test:e2e:debug

# 特定のブラウザで実行
npx playwright test --project=chromium
```

## ディレクトリ構造

```
xlo-system/
├── e2e/                      # E2Eテスト（Playwright）
│   └── smoke.spec.ts         # スモークテスト
├── lib/__tests__/            # ユニットテスト（Vitest）
│   └── utils.test.ts         # ユーティリティ関数テスト
├── components/__tests__/     # コンポーネントテスト
├── app/__tests__/            # ページテスト
└── supabase/functions/__tests__/  # Edge Functionテスト
```

## テスト作成ガイドライン

### ユニットテスト

- **目的**: 個別関数・ユーティリティの動作を検証
- **対象**: 純粋関数、ヘルパー、ビジネスロジック
- **命名**: `*.test.ts` または `*.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
  it('should handle null values', () => {
    const result = myFunction(null);
    expect(result).toBe(0);
  });
});
```

### コンポーネントテスト

- **目的**: Reactコンポーネントの描画・インタラクションを検証
- **対象**: UIコンポーネント
- **ツール**: Testing Library + Vitest

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2Eテスト

- **目的**: ユーザーフロー全体を検証
- **対象**: 認証、投稿作成、エンゲージメント実行など
- **命名**: `*.spec.ts` (e2eディレクトリ内)

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Flow', () => {
  test('can login and view dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    // ... test steps
  });
});
```

## 挙動凍結の原則

リファクタリング時は必ず：

1. **変更前にテストを書く**
   ```bash
   # 現在の挙動をテストに固定
   npm run test -- --run
   ```

2. **リファクタリング実施**
   - コード構造のみ変更
   - 挙動は変えない

3. **テストで検証**
   ```bash
   # すべてのテストがパスすることを確認
   npm run test -- --run
   npm run test:e2e
   ```

## CI/CD統合

GitHub Actionsでテストを自動実行：

```yaml
# .github/workflows/test.yml
- name: Run unit tests
  run: npm run test -- --run

- name: Run E2E tests
  run: npm run test:e2e
```

## カバレッジ目標

- **ユニットテスト**: 主要なビジネスロジック関数は100%
- **コンポーネントテスト**: 重要なUIコンポーネントは80%以上
- **E2Eテスト**: 主要なユーザーフロー3つは必須
  1. 認証フロー
  2. アカウント管理
  3. 投稿・エンゲージメント実行

## トラブルシューティング

### Playwrightブラウザが見つからない

```bash
npx playwright install
```

### テストがタイムアウトする

```bash
# タイムアウトを延長
npm run test:e2e -- --timeout=60000
```

### 環境変数が読み込まれない

`.env.local`を作成し、必要な環境変数を設定してください：

```bash
cp .env.example .env.local
# .env.local を編集
```

## 参考リンク

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
