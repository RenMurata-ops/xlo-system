# 🔐 緊急: Supabaseキーのローテーション手順

## ⚠️ 重要な理由

以前、以下の秘密情報がGitHubにコミットされていました：
- Supabase Service Role Key
- Supabase Anon Key
- データベースパスワード
- 管理者メールアドレス

これらの情報は**全世界に公開されている状態**です。

## 🚨 直ちに実施すべきこと

### 1. Supabaseキーのローテーション

#### 手順

1. **Supabaseダッシュボードにアクセス**
   ```
   https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr
   ```

2. **Settings > API に移動**

3. **Service Role Keyをリセット**
   - "Reset service_role key" をクリック
   - 新しいキーが生成される
   - すぐにコピーして安全な場所に保存

4. **Anon Keyをリセット**
   - "Reset anon key" をクリック
   - 新しいキーが生成される
   - すぐにコピーして安全な場所に保存

5. **データベースパスワードをリセット**
   - Settings > Database に移動
   - "Reset database password" をクリック
   - 新しいパスワードを生成
   - すぐにコピーして安全な場所に保存

### 2. 環境変数の更新

#### ローカル開発環境

```bash
# .env.local を編集
NEXT_PUBLIC_SUPABASE_ANON_KEY=<新しいAnon Key>
SUPABASE_SERVICE_ROLE_KEY=<新しいService Role Key>
DATABASE_URL=postgresql://postgres:<新しいパスワード>@db.swyiwqzlmozlqircyyzr.supabase.co:5432/postgres
```

#### Vercel (本番環境)

1. Vercelダッシュボードにアクセス
   ```
   https://vercel.com/your-project/settings/environment-variables
   ```

2. 以下の環境変数を更新:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`

3. **再デプロイを実行**
   - Deployments タブから最新デプロイを選択
   - "Redeploy" をクリック

#### Supabase Edge Functions

Edge Functionsも新しいキーを使用する必要があります：

```bash
# 環境変数を更新して再デプロイ
SUPABASE_ACCESS_TOKEN="sbp_***" \
supabase functions deploy --project-ref swyiwqzlmozlqircyyzr
```

### 3. 既存アクセストークンの無効化

すべてのユーザーのTwitter OAuth トークンを確認：

```sql
-- Supabase SQL Editorで実行
SELECT
  x_username,
  created_at,
  expires_at
FROM account_tokens
WHERE is_active = true
ORDER BY created_at DESC;
```

不審なアクティビティがあれば、該当トークンを無効化してください。

### 4. 監査ログの確認

Supabaseダッシュボードで：
1. Reports > Auth Logs を確認
2. 不審なログインがないか確認
3. Database Logs で不審なクエリがないか確認

## ✅ ローテーション完了チェックリスト

- [ ] Supabase Service Role Keyをリセット
- [ ] Supabase Anon Keyをリセット
- [ ] データベースパスワードをリセット
- [ ] ローカル .env.local を更新
- [ ] Vercel環境変数を更新
- [ ] Vercelを再デプロイ
- [ ] Edge Functionsを再デプロイ
- [ ] 既存トークンを確認
- [ ] 監査ログを確認
- [ ] アプリケーションが正常に動作することを確認

## 📝 今後の予防策

1. **絶対にREADMEに秘密情報を書かない**
2. **`.env.example`にはプレースホルダーのみ**
3. **`.env.local`は必ず.gitignoreに含める**
4. **定期的なキーローテーション（3ヶ月ごと推奨）**
5. **GitHub Secret Scanningを有効化**

## 🆘 問題が発生した場合

アプリケーションが動かなくなった場合：

1. ブラウザのコンソールでエラーを確認
2. Supabase Edge Functions のログを確認
3. Vercelのデプロイログを確認
4. 環境変数が正しく設定されているか再確認

**このファイルは完了後にGitから削除しても構いません。**
