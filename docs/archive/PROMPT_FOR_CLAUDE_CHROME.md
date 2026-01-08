# Claude for Chrome用 - OAuth 2.0認証 & E2Eテスト実行プロンプト

以下のタスクを順番に実行してください：

---

## タスク1: Twitter Developer PortalでCallback URL更新

### 手順

1. **Twitter Developer Portalにアクセス**
   - URL: https://developer.twitter.com/en/portal/dashboard
   - ログインが必要な場合はログインする

2. **アプリ「xlotest」の設定を開く**
   - ダッシュボードからアプリ一覧を表示
   - 「xlotest」をクリック

3. **Callback URL / Redirect URLを更新**
   - 「Settings」または「Authentication settings」タブに移動
   - 「Edit」または「User authentication settings」の編集ボタンをクリック
   - **Callback URL / Redirect URL**を以下に変更：
     ```
     https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/twitter-oauth-callback-v2
     ```
   - 保存

4. **アプリ「soro1」でも同じ手順を実行**
   - 同じCallback URLに設定

5. **確認**
   - 両方のアプリでCallback URLが正しく設定されたことを確認
   - スクリーンショットを撮って結果を報告

---

## タスク2: Vercelアプリで新しいTwitterアカウント接続

### 手順

1. **Vercel本番環境にアクセス**
   - URL: https://xlo-system.vercel.app/accounts/main
   - ログインが必要な場合:
     - Email: sakamoto334422@gmail.com
     - Password: （ユーザーに確認）

2. **Twitter Accountsページに移動**
   - サイドバーまたはナビゲーションから「Twitter Accounts」または「Accounts」を探す
   - 該当ページが見つからない場合は、以下のURLを試す：
     - https://xlo-system.vercel.app/accounts
     - https://xlo-system.vercel.app/twitter-apps
     - https://xlo-system.vercel.app/settings

3. **新しいTwitterアカウントを接続**
   - 「Connect Twitter Account」、「Add Twitter Account」、または「Connect」ボタンを探す
   - ボタンをクリック

4. **Twitter OAuth画面で認証**
   - Twitterの認証画面が表示される
   - アカウント「BelviaCard60876」でログイン（必要に応じて）
   - アプリへのアクセス許可を「Authorize app」または「承認」ボタンで許可

5. **リダイレクト確認**
   - 認証後、自動的に https://xlo-system.vercel.app に戻ることを確認
   - エラーが発生した場合は、URLとエラーメッセージをスクリーンショットで報告

6. **接続確認**
   - Twitter Accountsページで「BelviaCard60876」が接続済みとして表示されることを確認
   - スクリーンショットを撮って報告

---

## タスク3: トークン確認（ターミナル操作）

### ターミナルで以下のコマンドを実行

```bash
curl -s -X POST "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/check-tokens" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MzI4NjYsImV4cCI6MjA3ODMwODg2Nn0.MIbwT2_YIeCCVHjLF2fBFrTSpyvL7jnrqkj3sb7GMgE" \
  -H "Content-Type: application/json" | jq '.tokens[] | select(.x_username=="BelviaCard60876")'
```

### 期待される結果

- `token_type: "oauth2"` が表示される
- `is_active: true` が表示される
- `access_token` が存在する
- 結果を報告

---

## タスク4: 最終E2Eテスト実行

### ターミナルで以下のコマンドを実行

```bash
curl -s -X POST "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-auto-engagement" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MzI4NjYsImV4cCI6MjA3ODMwODg2Nn0.MIbwT2_YIeCCVHjLF2fBFrTSpyvL7jnrqkj3sb7GMgE" \
  -H "Content-Type: application/json" | jq '.results[] | {rule_name, status, searched: .searched_count, actions_succeeded, actions_failed, error}'
```

### 期待される結果

**全てのルールで以下の条件を満たすこと：**

1. **AI関連いいね自動化**
   - `searched: 100`
   - `actions_succeeded: 10` (または少なくとも > 0)
   - `actions_failed: 0`
   - `status: "success"` または `"partial"`

2. **ChatGPTハッシュタグ監視**
   - `searched: 100`
   - `actions_succeeded: 10` (または少なくとも > 0)
   - `actions_failed: 0`
   - `status: "success"` または `"partial"`

3. **特定ツイートURL監視**
   - `error` がnullまたは無効なURLエラー以外
   - （このルールは無効なURLが設定されているため失敗は許容）

4. **特定ユーザー監視**
   - `searched: 100`
   - `actions_succeeded: 10` (または少なくとも > 0)
   - `actions_failed: 0`
   - `status: "success"` または `"partial"`

5. **XTEP参加**
   - `searched: 1`
   - `status: "success"`

### 結果の報告

- 全ての結果をコピーして報告
- 特に以下を確認：
  - ✅ 全ての検索が成功しているか（searched > 0）
  - ✅ アクションが成功しているか（actions_succeeded > 0）
  - ❌ 403エラーが発生していないか
  - ❌ "Authenticating with OAuth 2.0 Application-Only is forbidden" エラーが無いか

---

## タスク5: 結果の分析と報告

### 以下の形式で結果を報告してください

```
## タスク1結果: Twitter Developer Portal設定
- xlotest Callback URL: [成功/失敗]
- soro1 Callback URL: [成功/失敗]
- スクリーンショット: [添付]

## タスク2結果: Vercel OAuth認証
- 認証フロー: [成功/失敗]
- リダイレクト: [成功/失敗]
- アカウント接続表示: [成功/失敗]
- スクリーンショット: [添付]

## タスク3結果: トークン確認
- token_type: [値]
- is_active: [値]
- access_token存在: [はい/いいえ]

## タスク4結果: E2Eテスト
- AI関連いいね自動化: searched [数], actions_succeeded [数], actions_failed [数]
- ChatGPTハッシュタグ監視: searched [数], actions_succeeded [数], actions_failed [数]
- 特定ユーザー監視: searched [数], actions_succeeded [数], actions_failed [数]
- XTEP参加: searched [数], status [値]

## 総合評価
- 全機能正常動作: [はい/いいえ]
- 発生したエラー: [リスト]
```

---

## トラブルシューティング

### Twitter Developer Portalでエラーが出る場合
- App Permissionsが「Read and Write」になっているか確認
- Callback URLフィールドが正しく保存されているか確認

### OAuth認証でエラーが出る場合
- ブラウザのコンソールログを確認（F12キー）
- エラーメッセージとURLをコピーして報告

### アクションが失敗する場合
- タスク3でtoken_typeが"oauth2"であることを確認
- Bearer Token（App-Only）が使われていないか確認
- エラーレスポンスの詳細を報告

---

## 重要な注意事項

1. **認証は1回だけ実行**
   - 既にアカウントが接続されている場合は、一度削除してから再接続する

2. **タイムアウト**
   - E2Eテストは数分かかる場合がある
   - 完了まで待つ

3. **エラーが出たら即報告**
   - エラーメッセージ全文をコピー
   - URLとスクリーンショットを含める

---

## 開始してください

上記のタスク1から順番に実行し、各タスクの結果を報告してください。
