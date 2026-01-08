# セキュリティインシデントレポート

**日付**: 2026-01-09
**レポートID**: SEC-2026-01-09-001
**重大度**: HIGH
**ステータス**: 修正完了 - トークンローテーション必須

---

## インシデント概要

### 発見された問題
OPERATIONS_GUIDE.md に実際の Supabase Access Token (`sbp_abce6574074ffd02eacd722c71836d1954b75978`) が12箇所ハードコードされていました。

### 影響範囲
- **ファイル**: OPERATIONS_GUIDE.md
- **露出箇所**: 12箇所
- **露出期間**: ファイル作成時 (2026-01-09) ～ 修正時 (2026-01-09)
- **Git コミット状況**: ステージング済み (コミット前に発見)
- **リモートリポジトリ**: 未プッシュ (漏洩なし)

### リスクレベル
🔴 **HIGH**
- このトークンで Supabase の管理操作が可能
- Edge Functions のシークレット管理が可能
- データベースへの直接アクセスは不可 (Access Token であり Service Role Key ではない)

---

## 実施した対応

### 1. 即座の修正 ✅
```bash
# すべての実トークンをプレースホルダーに置換
sed -i '' 's/sbp_abce6574074ffd02eacd722c71836d1954b75978/YOUR_SUPABASE_ACCESS_TOKEN/g' OPERATIONS_GUIDE.md
```

**結果**: 12箇所すべてをプレースホルダーに置換完了

### 2. セキュリティ警告の追加 ✅
OPERATIONS_GUIDE.md にセキュリティ注意事項セクションを追加:
- トークンがプレースホルダーであることを明示
- 実際のトークンをコミットしないよう警告
- 漏洩時のローテーション手順を記載

### 3. SESSION_SUMMARY.md の更新 ✅
セキュリティ修正セクションを追加し、トークンローテーション手順を文書化

---

## 必須アクション（未完了）

### ⚠️ トークンローテーション（即座に実行）

**手順**:
1. Supabase Dashboard にログイン
   - https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr

2. Settings → API → Access Tokens に移動

3. 漏洩したトークンを特定
   - トークン名: (作成時の名前を確認)
   - トークン値: `sbp_abce...978` (最初と最後の3文字で特定)

4. "Revoke" ボタンをクリック
   - 確認ダイアログで "Revoke" を選択

5. 新しい Access Token を生成
   - "Generate New Token" をクリック
   - Token Name: `cli-access-token-2026-01-09` (推奨)
   - Scopes: すべて選択 (または必要なスコープのみ)
   - "Generate Token" をクリック

6. 新しいトークンをコピーして安全に保存
   - 1Password / Bitwarden / Vault 等に保存
   - ⚠️ このトークンは二度と表示されません

7. 環境変数を更新
   ```bash
   # ローカル環境 (~/.bashrc or ~/.zshrc)
   export SUPABASE_ACCESS_TOKEN="sbp_NEW_TOKEN_HERE"

   # CI/CD 環境
   # GitHub Actions / GitLab CI 等でシークレットを更新
   ```

8. 新しいトークンで動作確認
   ```bash
   SUPABASE_ACCESS_TOKEN="sbp_NEW_TOKEN_HERE" \
   supabase projects list
   ```

---

## 根本原因分析

### なぜ発生したか
1. **ドキュメント作成時の過失**: 実際のコマンド実行結果をそのまま文書化
2. **プレースホルダー使用の不徹底**: トークン値をプレースホルダーに置換せず
3. **レビュープロセスの欠如**: コミット前のセキュリティチェックが不足

### 再発防止策

#### 即座に実施
- [x] OPERATIONS_GUIDE.md からトークンを削除
- [x] セキュリティ警告を追加
- [ ] 漏洩したトークンをローテーション

#### プロセス改善
- [ ] pre-commit hook でシークレットスキャン導入
  ```bash
  # .git/hooks/pre-commit
  #!/bin/bash
  if git diff --cached | grep -E "sbp_[a-zA-Z0-9]{40}"; then
    echo "ERROR: Supabase Access Token detected in staged files"
    exit 1
  fi
  ```

- [ ] .gitignore にドキュメント生成時の一時ファイルを追加
  ```
  # Documentation drafts with real credentials
  *_DRAFT.md
  *_WORKING.md
  ```

- [ ] ドキュメントテンプレートを作成
  - すべての認証情報をプレースホルダーで記載
  - 例: `YOUR_SUPABASE_ACCESS_TOKEN`, `YOUR_PROJECT_REF`

#### 技術的対策
- [ ] gitleaks / truffleHog 等のシークレットスキャナー導入
- [ ] GitHub Secret Scanning の有効化 (GitHub 使用時)
- [ ] 定期的なトークンローテーション (90日ごと)

---

## タイムライン

| 時刻 | イベント | アクション |
|------|---------|-----------|
| 2026-01-09 03:00 (推定) | OPERATIONS_GUIDE.md 作成時にトークン埋め込み | - |
| 2026-01-09 03:25 | `git add OPERATIONS_GUIDE.md` 実行 | ステージング |
| 2026-01-09 03:30 | ユーザーによるコードレビュー | **トークン漏洩を発見** |
| 2026-01-09 03:31 | トークンをプレースホルダーに置換 | 修正完了 |
| 2026-01-09 03:32 | セキュリティ警告を追加 | ドキュメント更新 |
| 2026-01-09 03:33 | SESSION_SUMMARY.md にインシデント記載 | 文書化完了 |

**重要**: トークンは Git リモートリポジトリにプッシュされていないため、外部漏洩のリスクは低いです。

---

## チェックリスト

### 即座に実行（24時間以内）
- [x] トークンをプレースホルダーに置換
- [x] セキュリティ警告を追加
- [ ] **漏洩したトークンをローテーション（最優先）**
- [ ] 新しいトークンを安全に保存
- [ ] ローカル環境変数を更新

### 1週間以内
- [ ] pre-commit hook を追加
- [ ] gitleaks をインストール・設定
- [ ] チーム全体にセキュリティ注意喚起

### 1ヶ月以内
- [ ] ドキュメントテンプレートを作成
- [ ] シークレットスキャン自動化を CI/CD に統合
- [ ] トークンローテーションポリシーを策定

---

## 学んだ教訓

1. **ドキュメントにシークレットを直接書かない**
   - 常にプレースホルダーを使用
   - 実際の値は別の安全な場所に保管

2. **コミット前のレビューが重要**
   - 今回はステージング後、コミット前に発見
   - 早期発見により外部漏洩を防止

3. **自動化されたチェックが必要**
   - 人的ミスは防げない
   - pre-commit hook や CI/CD での自動スキャンが有効

---

**レポート作成者**: Claude Code
**最終更新**: 2026-01-09
**ステータス**: 修正完了 - トークンローテーション保留中
