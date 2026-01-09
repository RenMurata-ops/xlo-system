# Cron ジョブ設定ガイド（5分で完了）

## 🎯 これだけやれば完了です

**所要時間**: 約5分
**難易度**: 簡単（コピー&ペーストのみ）

---

## 📋 設定する内容

以下の3つの自動実行ジョブを設定します：

1. **トークン自動更新** - 1時間ごと
2. **スケジュール投稿実行** - 5分ごと
3. **フォロワー数同期** - 毎日0時

---

## 🚀 設定手順（3ステップ）

### ステップ 1: Supabase Dashboard を開く

1. ブラウザで以下のURLを開く:
   ```
   https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/database/cron-jobs
   ```

2. ログインしていない場合はログイン

### ステップ 2: Cron ジョブを1つずつ追加

**「Create a new cron job」または「+ New cron job」ボタンをクリック**

---

#### ジョブ 1: トークン自動更新

| 項目 | 入力内容 |
|-----|---------|
| **Name** | `refresh-tokens-hourly` |
| **Schedule** | `0 * * * *` |
| **Command** または **SQL** | 以下をコピー&ペースト ⬇️ |

```sql
SELECT net.http_post(
  url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens',
  headers := jsonb_build_object(
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
) AS request_id;
```

**保存してください**

---

#### ジョブ 2: スケジュール投稿実行

| 項目 | 入力内容 |
|-----|---------|
| **Name** | `execute-scheduled-posts` |
| **Schedule** | `*/5 * * * *` |
| **Command** または **SQL** | 以下をコピー&ペースト ⬇️ |

```sql
SELECT net.http_post(
  url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-scheduled-posts',
  headers := jsonb_build_object(
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
) AS request_id;
```

**保存してください**

---

#### ジョブ 3: フォロワー数同期

| 項目 | 入力内容 |
|-----|---------|
| **Name** | `sync-follower-counts-daily` |
| **Schedule** | `0 0 * * *` |
| **Command** または **SQL** | 以下をコピー&ペースト ⬇️ |

```sql
SELECT net.http_post(
  url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/sync-follower-counts',
  headers := jsonb_build_object(
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
) AS request_id;
```

**保存してください**

---

### ステップ 3: 設定確認

Cron Jobs ページで以下の3つのジョブが表示されていることを確認：

- ✅ `refresh-tokens-hourly` - Schedule: `0 * * * *`
- ✅ `execute-scheduled-posts` - Schedule: `*/5 * * * *`
- ✅ `sync-follower-counts-daily` - Schedule: `0 0 * * *`

---

## 🎉 完了！

これで全ての設定が完了しました。システムは以下のように自動で動作します：

- **毎時0分**: トークンが自動更新される
- **5分ごと**: スケジュール投稿が実行される
- **毎日0時**: フォロワー数が同期される

---

## 📝 スケジュール形式の説明

Cron の時刻指定形式：`分 時 日 月 曜日`

| スケジュール | 意味 |
|------------|------|
| `0 * * * *` | 毎時0分に実行 |
| `*/5 * * * *` | 5分ごとに実行 |
| `0 0 * * *` | 毎日0時0分に実行 |

---

## ❓ よくある質問

### Q1: Cron Jobs のメニューが見つからない

**A:** 以下の手順で探してください：
1. Supabase Dashboard のプロジェクトページを開く
2. 左サイドバーから「Database」をクリック
3. 「Cron Jobs」タブをクリック

または、`pg_cron` 拡張機能を有効化する必要がある場合があります：
- Database → Extensions → `pg_cron` を検索して有効化

### Q2: `net.http_post` が使えないと言われる

**A:** `pg_net` 拡張機能を有効化してください：
1. Database → Extensions
2. `pg_net` を検索
3. 「Enable」をクリック

### Q3: すぐに動作確認したい

**A:** 各 Cron ジョブの「Run now」ボタンをクリックすると、即座に実行できます。

### Q4: ログを確認したい

**A:** 以下の方法でログを確認できます：
1. Supabase Dashboard → Logs → Edge Functions
2. 各関数のログタブを開く
3. 実行履歴とエラーが表示されます

---

## 🚨 トラブルシューティング

### エラー: "Extension not found"

```sql
-- まず、必要な拡張機能を有効化
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

上記SQLを SQL Editor から実行してください。

### エラー: "Permission denied"

Service Role Key が正しいか確認してください：
- Settings → API → service_role key (secret)

---

## 📞 サポート

問題が発生した場合：
1. Supabase Dashboard → Logs でエラーログを確認
2. Edge Functions のログを確認
3. Cron Jobs の実行履歴を確認

---

**設定完了後、システムは完全自動で動作します！** 🎉
