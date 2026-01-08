-- セキュリティ強化: トークンとパスワードの暗号化
-- 実行前に pg_crypto 拡張が有効であることを確認してください
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ステップ1: 暗号化カラムを追加
ALTER TABLE account_tokens
  ADD COLUMN IF NOT EXISTS access_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted bytea;

ALTER TABLE main_accounts
  ADD COLUMN IF NOT EXISTS password_encrypted bytea,
  ADD COLUMN IF NOT EXISTS mail_password_encrypted bytea;

-- ステップ2: 暗号化キーを環境変数から取得する関数
-- 本番環境では vault.secrets または環境変数から取得することを推奨
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS text AS $$
BEGIN
  -- デフォルトキー（本番環境では環境変数から取得すべき）
  -- Supabase Vaultを使用する場合:
  -- RETURN (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ENCRYPTION_KEY' LIMIT 1);

  -- 環境変数から取得（Supabase Functions経由）:
  RETURN current_setting('app.settings.encryption_key', true);
EXCEPTION WHEN OTHERS THEN
  -- フォールバック: 固定キー（セキュリティリスク）
  RAISE WARNING 'Encryption key not found, using default (INSECURE)';
  RETURN 'xlo-default-encryption-key-change-me';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ステップ3: 既存データを暗号化する関数
CREATE OR REPLACE FUNCTION encrypt_existing_tokens()
RETURNS void AS $$
DECLARE
  encryption_key text;
  rec record;
BEGIN
  encryption_key := get_encryption_key();

  FOR rec IN SELECT id, access_token, refresh_token FROM account_tokens WHERE access_token IS NOT NULL LOOP
    UPDATE account_tokens
    SET
      access_token_encrypted = pgp_sym_encrypt(rec.access_token, encryption_key),
      refresh_token_encrypted = CASE
        WHEN rec.refresh_token IS NOT NULL THEN pgp_sym_encrypt(rec.refresh_token, encryption_key)
        ELSE NULL
      END
    WHERE id = rec.id;
  END LOOP;

  RAISE NOTICE 'Encrypted % tokens', (SELECT COUNT(*) FROM account_tokens WHERE access_token_encrypted IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- ステップ4: 既存パスワードを暗号化する関数
CREATE OR REPLACE FUNCTION encrypt_existing_passwords()
RETURNS void AS $$
DECLARE
  encryption_key text;
  rec record;
BEGIN
  encryption_key := get_encryption_key();

  FOR rec IN SELECT id, password, mail_password FROM main_accounts WHERE password IS NOT NULL LOOP
    UPDATE main_accounts
    SET
      password_encrypted = pgp_sym_encrypt(rec.password, encryption_key),
      mail_password_encrypted = CASE
        WHEN rec.mail_password IS NOT NULL THEN pgp_sym_encrypt(rec.mail_password, encryption_key)
        ELSE NULL
      END
    WHERE id = rec.id;
  END LOOP;

  RAISE NOTICE 'Encrypted % passwords', (SELECT COUNT(*) FROM main_accounts WHERE password_encrypted IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- ステップ5: 復号化ヘルパー関数
CREATE OR REPLACE FUNCTION decrypt_access_token(token_id uuid)
RETURNS text AS $$
DECLARE
  encryption_key text;
  encrypted_data bytea;
BEGIN
  encryption_key := get_encryption_key();

  SELECT access_token_encrypted INTO encrypted_data
  FROM account_tokens WHERE id = token_id;

  IF encrypted_data IS NULL THEN
    -- 暗号化されていない場合、平文を返す（移行期間）
    RETURN (SELECT access_token FROM account_tokens WHERE id = token_id);
  END IF;

  RETURN convert_from(pgp_sym_decrypt(encrypted_data, encryption_key), 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_refresh_token(token_id uuid)
RETURNS text AS $$
DECLARE
  encryption_key text;
  encrypted_data bytea;
BEGIN
  encryption_key := get_encryption_key();

  SELECT refresh_token_encrypted INTO encrypted_data
  FROM account_tokens WHERE id = token_id;

  IF encrypted_data IS NULL THEN
    RETURN (SELECT refresh_token FROM account_tokens WHERE id = token_id);
  END IF;

  IF encrypted_data IS NOT NULL THEN
    RETURN convert_from(pgp_sym_decrypt(encrypted_data, encryption_key), 'UTF8');
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ステップ6: 挿入/更新トリガー（自動暗号化）
CREATE OR REPLACE FUNCTION encrypt_token_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := get_encryption_key();

  IF NEW.access_token IS NOT NULL AND NEW.access_token_encrypted IS NULL THEN
    NEW.access_token_encrypted := pgp_sym_encrypt(NEW.access_token, encryption_key);
  END IF;

  IF NEW.refresh_token IS NOT NULL AND NEW.refresh_token_encrypted IS NULL THEN
    NEW.refresh_token_encrypted := pgp_sym_encrypt(NEW.refresh_token, encryption_key);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_tokens_trigger
BEFORE INSERT OR UPDATE ON account_tokens
FOR EACH ROW
EXECUTE FUNCTION encrypt_token_on_insert();

CREATE OR REPLACE FUNCTION encrypt_password_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := get_encryption_key();

  IF NEW.password IS NOT NULL AND NEW.password_encrypted IS NULL THEN
    NEW.password_encrypted := pgp_sym_encrypt(NEW.password, encryption_key);
  END IF;

  IF NEW.mail_password IS NOT NULL AND NEW.mail_password_encrypted IS NULL THEN
    NEW.mail_password_encrypted := pgp_sym_encrypt(NEW.mail_password, encryption_key);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_passwords_trigger
BEFORE INSERT OR UPDATE ON main_accounts
FOR EACH ROW
EXECUTE FUNCTION encrypt_password_on_insert();

-- ============================================
-- 実行手順（手動実行が必要）
-- ============================================
--
-- 1. pgcrypto拡張を有効化（まだの場合）
--    CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- 2. 暗号化キーを設定（本番環境）
--    ALTER DATABASE postgres SET app.settings.encryption_key = 'your-secret-key-here';
--
-- 3. 既存データを暗号化
--    SELECT encrypt_existing_tokens();
--    SELECT encrypt_existing_passwords();
--
-- 4. 確認
--    SELECT COUNT(*) FROM account_tokens WHERE access_token_encrypted IS NOT NULL;
--    SELECT COUNT(*) FROM main_accounts WHERE password_encrypted IS NOT NULL;
--
-- 5. 暗号化確認後、平文カラムを削除（慎重に！）
--    -- バックアップ推奨
--    -- ALTER TABLE account_tokens DROP COLUMN access_token, DROP COLUMN refresh_token;
--    -- ALTER TABLE main_accounts DROP COLUMN password, DROP COLUMN mail_password;
--
-- ============================================
-- アプリケーション側の対応
-- ============================================
--
-- Edge Functions で復号化関数を使用:
--   SELECT decrypt_access_token(token_id) AS access_token FROM account_tokens WHERE ...
--
-- または、暗号化カラムを直接復号化:
--   SELECT convert_from(pgp_sym_decrypt(access_token_encrypted, 'key'), 'UTF8') AS access_token
--
-- ============================================

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '暗号化マイグレーション準備完了';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '次のステップ:';
  RAISE NOTICE '1. 暗号化キーを設定';
  RAISE NOTICE '2. SELECT encrypt_existing_tokens(); を実行';
  RAISE NOTICE '3. SELECT encrypt_existing_passwords(); を実行';
  RAISE NOTICE '4. Edge Functions を更新して復号化関数を使用';
  RAISE NOTICE '';
END $$;
