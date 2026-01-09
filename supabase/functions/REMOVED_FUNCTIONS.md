# 削除されたEdge Functions

このファイルは、クリーンアップのために削除されたEdge Functionsのリストです。

## 削除日: 2026-01-09

### 削除理由: 未使用またはデバッグ用

以下の関数は本番環境で使用されていないため削除されました：

1. **check-rules** - デバッグ用
2. **check-tokens** - デバッグ用
3. **check-twitter-app** - デバッグ用
4. **check-user-rule** - デバッグ用
5. **debug-rules** - デバッグ専用（本番に残すべきでない）
6. **debug-token** - デバッグ専用（本番に残すべきでない）
7. **fix-token-type** - パッチ用（本来は自動化すべき）
8. **force-activate-token** - パッチ用（本来は自動化すべき）
9. **clear-token-error** - パッチ用（本来は自動化すべき）
10. **delete-bearer-token** - 機能重複の可能性
11. **insert-bearer-token** - 機能重複の可能性
12. **test-single-rule** - テスト用
13. **update-twitter-callback** - 使用不明

### 復元方法

もしこれらの関数が必要になった場合：

```bash
# Git tagから復元
git show v1.0-before-function-cleanup:supabase/functions/[function-name]/

# 特定の関数を復元
git checkout v1.0-before-function-cleanup -- supabase/functions/[function-name]/
```

### 残存する関数（24個）

- **_shared/** - 共有ユーティリティ
- **detect-followbacks** - フォローバック検出
- **disable-invalid-rule** - 無効ルール処理
- **dispatch-dms** - DM送信
- **execute-auto-engagement** - 自動エンゲージメント
- **execute-auto-unfollow** - 自動アンフォロー
- **execute-bulk-posts** - 一括投稿
- **execute-cta-loop** - CTAループ
- **execute-cta-triggers** - CTAトリガー
- **execute-loop** - ループ実行
- **execute-scheduled-posts** - 予約投稿
- **execute-single-post** - 単一投稿
- **execute-targeted-engagement** - ターゲットエンゲージメント
- **fetch-post-engagement** - 投稿エンゲージメント取得
- **refresh-token** - トークンリフレッシュ（要統合検討）
- **refresh-tokens** - トークン一括リフレッシュ
- **refresh-twitter-token** - Twitterトークンリフレッシュ（要統合検討）
- **schedule-loop-execution** - ループスケジュール
- **sync-follower-counts** - フォロワー数同期
- **twitter-api-proxy** - Twitter APIプロキシ
- **twitter-oauth-callback-v2** - OAuth コールバック
- **twitter-oauth-start** - OAuth 開始

### 次の統合候補

以下の関数は類似機能のため統合を検討：

- `refresh-token` + `refresh-tokens` + `refresh-twitter-token` → 1つに統合可能
