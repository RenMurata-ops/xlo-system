# プロキシ設定ガイド（NordVPN）

## 現在のプロキシ状況

### ✅ データベース準備済み
- `proxies` テーブルが存在し、プロキシ情報を管理可能
- プロキシの自動割り当て機能が実装済み
- プロキシのヘルスチェック機能が実装済み

### ⚠️ 未実装部分
**Twitter API プロキシ機能が現在無効化されています**

`supabase/functions/twitter-api-proxy/index.ts` では、Twitter APIへのリクエストを直接送信しており、
データベースに登録されたプロキシを経由していません。

これは以下のような理由で無効化されている可能性があります：
1. 開発・テスト環境ではプロキシ不要
2. Supabase Edge Functions での HTTP プロキシ実装の複雑さ
3. 本番環境でプロキシが必要になった際に有効化予定

---

## NordVPN プロキシ設定手順

### ステップ 1: NordVPN プロキシ情報の取得

1. **NordVPN アカウントにログイン**
   - https://my.nordaccount.com/ にアクセス
   - ログイン情報を入力

2. **サービス認証情報を確認**
   - ダッシュボード → サービス → NordVPN
   - 「Manual Setup」または「手動設定」セクションを開く
   - **Service credentials** (サービス認証情報) をメモ:
     - Username: `xxxxxxxxxxxxx` (例: service_username)
     - Password: `xxxxxxxxxxxxx` (例: long_random_password)

3. **プロキシサーバーリストを取得**
   - NordVPN プロキシサーバーリスト: https://nordvpn.com/servers/tools/
   - または以下のコマンドで取得:
   ```bash
   curl https://api.nordvpn.com/v1/servers/recommendations?limit=10
   ```

4. **推奨プロキシサーバー**
   - SOCKS5 プロキシ (推奨): `socks5://[サーバー名].nordvpn.com:1080`
   - HTTP プロキシ: `http://[サーバー名].nordvpn.com:80`
   - HTTPS プロキシ: `https://[サーバー名].nordvpn.com:89`

### ステップ 2: データベースにプロキシを登録

XLO System のプロキシ管理ページ (`/proxies`) から登録できます。

または、SQL で直接登録:

```sql
-- プロキシ情報を追加
INSERT INTO proxies (user_id, proxy_url, proxy_type, username, password, country, city, is_active)
VALUES (
  'your-user-id',  -- ユーザーID
  'socks5://us1234.nordvpn.com:1080',  -- プロキシURL
  'socks5',  -- プロキシタイプ
  'your_nordvpn_service_username',  -- NordVPN サービスユーザー名
  'your_nordvpn_service_password',  -- NordVPN サービスパスワード
  'US',  -- 国コード
  'New York',  -- 都市名（オプション）
  true  -- 有効化
);
```

### ステップ 3: プロキシ機能の有効化 (開発者向け)

現在、Twitter API プロキシ機能が無効化されているため、有効化するには以下の手順が必要です:

#### 3-1. Deno での HTTP プロキシ実装

`supabase/functions/twitter-api-proxy/index.ts` を修正:

```typescript
// プロキシ情報を取得
const { data: proxy, error: proxyError } = await supabase
  .from('proxies')
  .select('*')
  .eq('is_active', true)
  .eq('user_id', userId)
  .limit(1)
  .single();

if (proxy) {
  // Deno の fetch では HTTP_PROXY/HTTPS_PROXY 環境変数を使用
  // または、proxy-agent を使った実装が必要

  // Option 1: 環境変数を設定 (Deno の fetch が自動で使用)
  Deno.env.set('HTTP_PROXY', proxy.proxy_url);
  Deno.env.set('HTTPS_PROXY', proxy.proxy_url);

  // Option 2: カスタム fetch 実装
  // SOCKS5 プロキシの場合は専用ライブラリが必要
}
```

**注意事項:**
- Deno の標準 `fetch` は SOCKS5 プロキシを直接サポートしていません
- SOCKS5 を使用する場合は、npm パッケージ `socks-proxy-agent` などが必要
- Supabase Edge Functions の制約により、一部のプロキシ機能が制限される可能性があります

#### 3-2. プロキシローテーション機能

複数のプロキシを登録し、リクエストごとにローテーション:

```typescript
// ランダムなプロキシを選択
const { data: proxies } = await supabase
  .from('proxies')
  .select('*')
  .eq('is_active', true)
  .eq('user_id', userId);

if (proxies && proxies.length > 0) {
  const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
  // プロキシを使用
}
```

---

## よくある質問 (FAQ)

### Q1: どのプロキシタイプを選ぶべきですか？

**A:** 用途によって選択してください:
- **SOCKS5 (推奨)**: 最も高速で汎用性が高い
- **HTTP/HTTPS**: Web ベースのトラフィックのみ

### Q2: プロキシなしでも動作しますか？

**A:** はい、現在のシステムはプロキシなしで動作します。
プロキシは以下のような場合に必要です:
- Twitter API のレート制限を回避したい
- 複数のIPアドレスから分散してリクエストを送りたい
- 特定の地域からのアクセスが必要

### Q3: プロキシの動作確認方法は？

**A:** XLO System のプロキシ管理ページ (`/proxies`) で「ヘルスチェック」ボタンをクリックしてください。
または、以下のコマンドで手動確認:

```bash
# SOCKS5 プロキシのテスト
curl --proxy socks5://username:password@us1234.nordvpn.com:1080 https://api.ipify.org

# HTTP プロキシのテスト
curl --proxy http://username:password@us1234.nordvpn.com:80 https://api.ipify.org
```

### Q4: プロキシが動作しない場合は？

**A:** 以下を確認してください:
1. NordVPN サービス認証情報が正しいか
2. プロキシサーバーが稼働しているか (NordVPN のステータスページで確認)
3. プロキシ URL の形式が正しいか
4. データベースで `is_active = true` になっているか

---

## プロキシ実装の推奨事項

### 開発環境
- プロキシなしで開発・テスト
- 必要に応じてプロキシ機能を有効化

### 本番環境
1. **複数のプロキシを登録** (最低 3-5 個)
2. **プロキシローテーション** を実装
3. **ヘルスチェック** を定期実行 (1時間ごと)
4. **失敗時のフォールバック** を実装 (プロキシなしでリトライ)

### セキュリティ
- プロキシ認証情報は環境変数またはデータベースで管理
- プレーンテキストでの保存は避ける (暗号化推奨)
- アクセスログを定期的に確認

---

## 参考リンク

- [NordVPN Manual Setup Guide](https://support.nordvpn.com/Connectivity/Proxy/)
- [NordVPN Server Recommendations API](https://nordvpn.com/api/)
- [Deno HTTP Client Documentation](https://deno.land/manual/runtime/http_server_apis)
- [Twitter API Rate Limits](https://developer.twitter.com/en/docs/twitter-api/rate-limits)

---

## 更新履歴

- 2025-12-17: 初版作成
  - 現在のプロキシ状況の説明
  - NordVPN プロキシ設定手順の追加
  - FAQ セクションの追加
