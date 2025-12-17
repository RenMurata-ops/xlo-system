# XLO System - 即時実施チェックリスト

## ✅ 今すぐやるべきこと（5分で完了）

### 🎯 必須タスク: Cron ジョブ設定のみ

**状況**:
- ✅ データベース: 完全構築済み
- ✅ Edge Functions: 全てデプロイ済み
- ✅ フロントエンド: ビルド成功
- ⏳ **Cron ジョブ: 設定が必要** ← これだけやればOK

---

## 📋 設定手順（超簡単版）

### 1. Supabase Dashboard を開く

ブラウザで開く:
```
https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr/database/cron-jobs
```

### 2. 拡張機能を有効化（初回のみ）

もし Cron Jobs メニューが見つからない場合：

1. Database → Extensions
2. `pg_cron` を検索 → Enable
3. `pg_net` を検索 → Enable

### 3. 以下の3つのCronジョブを作成

#### ジョブ 1️⃣: トークン自動更新（毎時）

```
Name: refresh-tokens-hourly
Schedule: 0 * * * *
```

SQL:
```sql
SELECT net.http_post(
  url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens',
  headers := jsonb_build_object(
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);
```

---

#### ジョブ 2️⃣: スケジュール投稿実行（5分ごと）

```
Name: execute-scheduled-posts
Schedule: */5 * * * *
```

SQL:
```sql
SELECT net.http_post(
  url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-scheduled-posts',
  headers := jsonb_build_object(
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);
```

---

#### ジョブ 3️⃣: フォロワー数同期（毎日0時）

```
Name: sync-follower-counts-daily
Schedule: 0 0 * * *
```

SQL:
```sql
SELECT net.http_post(
  url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/sync-follower-counts',
  headers := jsonb_build_object(
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);
```

---

## ✅ 確認方法

Cron Jobs ページに3つのジョブが表示されていればOK:

- ✅ refresh-tokens-hourly (0 * * * *)
- ✅ execute-scheduled-posts (*/5 * * * *)
- ✅ sync-follower-counts-daily (0 0 * * *)

---

## 🎉 完了後の状態

設定完了後、システムは以下のように**完全自動**で動作します:

| 時刻 | 動作 |
|-----|------|
| 毎時0分 | Twitter トークンが自動更新 |
| 5分ごと | スケジュール投稿が自動実行 |
| 毎日0時 | フォロワー数が自動同期 |

**これだけで XLO System が完全に稼働します！** 🚀

---

## 📚 詳細情報

詳しい手順は `CRON_SETUP_GUIDE.md` を参照してください。

---

## ⏭️ 次のステップ（オプション）

Cron 設定後、以下をテストすることを推奨：

1. **Post Loop のテスト**
   - `/loops` ページで Post Loop を作成
   - テンプレートを選択
   - 「実行」をクリック

2. **OAuth 認証のテスト**
   - `/accounts/main` でアカウント追加
   - Twitter 連携をテスト

3. **スケジュール投稿のテスト**
   - `/posts` で新規投稿作成
   - 5分後の時刻を設定
   - 自動投稿されることを確認

---

**所要時間: 5分**
**難易度: 簡単**
**作業内容: コピー&ペーストのみ**
