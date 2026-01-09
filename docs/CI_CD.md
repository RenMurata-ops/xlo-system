# CI/CD - Continuous Integration

**実施日**: 2026-01-09

## 概要

GitHub Actionsを使用した自動テストパイプラインを導入しました。

すべてのPRとmainブランチへのpushで自動的に以下を実行:
- ✅ ESLint (コード品質チェック)
- ✅ TypeScript型チェック
- ✅ ユニットテスト (Vitest)
- ✅ E2Eテスト (Playwright)

## ワークフロー構成

### ファイル

`.github/workflows/test.yml`

### 実行タイミング

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

- **mainブランチへのpush**: すべてのテストを実行
- **Pull Request**: すべてのテストを実行

### ジョブ構成

#### 1. Lint and Type Check

**実行内容**:
- ESLint によるコード品質チェック
- TypeScript型チェック

**コマンド**:
```bash
npm run lint
npm run typecheck
```

**目的**: コードスタイルと型安全性を保証

#### 2. Unit Tests

**実行内容**:
- Vitest によるユニットテスト実行
- カバレッジレポート生成

**コマンド**:
```bash
npm run test -- --run
```

**成果物**:
- `coverage/` - カバレッジレポート (30日保存)

**目的**: 個別関数・ユーティリティの動作保証

#### 3. E2E Tests

**実行内容**:
- Playwright によるE2Eテスト実行
- Chromiumブラウザでの自動テスト

**コマンド**:
```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

**成果物**:
- `playwright-report/` - テストレポート (30日保存)
- `test-results/` - スクリーンショット (失敗時のみ、30日保存)

**目的**: ユーザーフロー全体の動作保証

## ステータスバッジ

### README.mdに追加

```markdown
[![Test](https://github.com/RenMurata-ops/xlo-system/actions/workflows/test.yml/badge.svg)](https://github.com/RenMurata-ops/xlo-system/actions/workflows/test.yml)
```

リポジトリのトップページで一目でテスト状況を確認可能:
- ✅ 緑: すべてのテストが成功
- ❌ 赤: テストが失敗

## ローカル実行

CI環境と同じテストをローカルで実行:

```bash
# すべてのテストを順番に実行
npm run lint
npm run typecheck
npm run test -- --run
npm run test:e2e

# または、並列実行
npm run lint & npm run typecheck & npm run test -- --run & npm run test:e2e
```

## テスト結果の確認

### GitHub Actions画面

1. リポジトリの **Actions** タブを開く
2. 最新のワークフロー実行を選択
3. 各ジョブの詳細を確認

### アーティファクトのダウンロード

失敗時のデバッグに使用:

1. Actions画面でワークフロー実行を開く
2. **Artifacts** セクションから以下をダウンロード:
   - `coverage` - カバレッジレポート
   - `playwright-report` - E2Eテストレポート
   - `test-results` - 失敗時のスクリーンショット

## 環境変数

### CI環境での設定

現在、環境変数は不要です（テストはモックを使用）。

将来的に必要になった場合:

1. リポジトリの **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** をクリック
3. 秘密情報を追加（例: `SUPABASE_URL`, `SUPABASE_ANON_KEY`）

ワークフローで使用:
```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

## キャッシュ最適化

### npm依存関係のキャッシュ

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'  # package-lock.jsonをキャッシュ
```

**効果**: 2回目以降のビルドが高速化（約30秒 → 約10秒）

### Playwrightブラウザのキャッシュ

Playwrightブラウザは自動的にキャッシュされます。

## パフォーマンス

### 実行時間

| ジョブ | 所要時間 (初回) | 所要時間 (キャッシュ後) |
|--------|----------------|---------------------|
| Lint & Type Check | ~45秒 | ~20秒 |
| Unit Tests | ~30秒 | ~15秒 |
| E2E Tests | ~2分 | ~1分 |
| **合計** | **~3分15秒** | **~1分35秒** |

### 並列実行

3つのジョブは並列実行されるため、実際の待ち時間は最も遅いジョブ（E2Eテスト）の時間:

**実質待ち時間**: ~2分（初回）、~1分（キャッシュ後）

## トラブルシューティング

### Playwrightブラウザインストールエラー

**症状**: `npx playwright install` が失敗

**解決策**:
```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
```

`--with-deps`でシステム依存関係も自動インストール。

### テストタイムアウト

**症状**: E2Eテストがタイムアウト

**解決策**: `playwright.config.ts`でタイムアウトを延長:
```typescript
export default defineConfig({
  timeout: 60000, // 60秒
});
```

### メモリ不足

**症状**: ビルドやテストがメモリ不足で失敗

**解決策**: ワークフローでNode.jsメモリ上限を設定:
```yaml
env:
  NODE_OPTIONS: --max_old_space_size=4096
```

## ベストプラクティス

### 1. PRマージ前に必ずテスト成功を確認

```bash
# ローカルで全テストを実行
npm run lint && npm run typecheck && npm run test -- --run && npm run test:e2e
```

### 2. テスト失敗時は即修正

CIが赤くなったらすぐに修正。放置すると他の開発者がブロックされます。

### 3. 新機能追加時はテストも追加

```bash
# 新機能実装
# ↓
# テスト追加
# ↓
# CI実行確認
```

### 4. カバレッジを維持

```bash
npm run test:coverage
```

目標カバレッジ:
- ユニットテスト: 80%以上
- E2Eテスト: 主要フロー3つをカバー

## 将来の拡張

### 1. デプロイ自動化

```yaml
deploy:
  needs: [lint-and-typecheck, unit-tests, e2e-tests]
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to Supabase
      run: supabase functions deploy
```

### 2. パフォーマンステスト

```yaml
performance-tests:
  runs-on: ubuntu-latest
  steps:
    - name: Run Lighthouse
      run: npm run lighthouse
```

### 3. セキュリティスキャン

```yaml
security-scan:
  runs-on: ubuntu-latest
  steps:
    - name: Run npm audit
      run: npm audit --production
```

### 4. ブランチ保護ルール

リポジトリ Settings → Branches → Add rule:

- **Branch name pattern**: `main`
- **Require status checks to pass**: ✅
  - `lint-and-typecheck`
  - `unit-tests`
  - `e2e-tests`
- **Require branches to be up to date**: ✅

これにより、テストが成功しないとmainにマージできなくなります。

## まとめ

✅ **導入完了**: GitHub Actions CI
✅ **自動テスト**: Lint, TypeCheck, Unit, E2E
✅ **並列実行**: 約2分で全テスト完了
✅ **成果物保存**: カバレッジ、レポート、スクリーンショット
✅ **ステータスバッジ**: README.mdで一目で確認

CI導入により、コードの品質が自動的に保証され、リグレッションを防ぐことができます。

---

*作成日: 2026-01-09*
*関連PR: #10 GitHub Actions CI追加*
