-- スキーマ確認: エンゲージメント関連のテーブル名を確認

-- 1. すべてのテーブル一覧を取得
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%engagement%'
    OR table_name LIKE '%execution%'
    OR table_name LIKE '%rule%'
  )
ORDER BY table_name;

-- 2. エンゲージメント関連のテーブル構造を確認
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE '%engagement%'
ORDER BY table_name, ordinal_position;
