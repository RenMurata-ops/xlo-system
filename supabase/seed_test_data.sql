-- Test Data Seeding for E2E Tests
-- This file creates test users, apps, templates, and other data needed for E2E testing

-- ============================================================================
-- 1. Create Test User
-- ============================================================================

-- Create test user (email: test@xlo-system.com, password: TestPassword123!)
-- Note: This uses Supabase Auth, so we need to use the proper auth schema

DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Check if test user already exists
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'test@xlo-system.com';

  IF test_user_id IS NULL THEN
    -- Insert test user into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'test@xlo-system.com',
      crypt('TestPassword123!', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO test_user_id;

    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      test_user_id,
      format('{"sub":"%s","email":"test@xlo-system.com"}', test_user_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Test user created with ID: %', test_user_id;
  ELSE
    RAISE NOTICE 'Test user already exists with ID: %', test_user_id;
  END IF;
END $$;

-- ============================================================================
-- 2. Create Test Twitter Apps
-- ============================================================================

INSERT INTO twitter_apps (
  user_id,
  app_name,
  client_id,
  client_secret,
  created_at,
  updated_at
)
SELECT
  id,
  'Test Twitter App 1',
  'test_client_id_1',
  'test_client_secret_1',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'test@xlo-system.com'
ON CONFLICT DO NOTHING;

INSERT INTO twitter_apps (
  user_id,
  app_name,
  client_id,
  client_secret,
  created_at,
  updated_at
)
SELECT
  id,
  'Test Twitter App 2',
  'test_client_id_2',
  'test_client_secret_2',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'test@xlo-system.com'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. Create Test Main Accounts
-- ============================================================================

INSERT INTO main_accounts (
  user_id,
  handle,
  name,
  follower_count,
  following_count,
  created_at,
  updated_at
)
SELECT
  id,
  'test_main_account_1',
  'Test Main Account 1',
  1000,
  500,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'test@xlo-system.com'
ON CONFLICT DO NOTHING;

INSERT INTO main_accounts (
  user_id,
  handle,
  name,
  follower_count,
  following_count,
  created_at,
  updated_at
)
SELECT
  id,
  'test_main_account_2',
  'Test Main Account 2',
  2000,
  800,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'test@xlo-system.com'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. Create Test Account Tokens
-- ============================================================================

INSERT INTO account_tokens (
  user_id,
  account_id,
  account_type,
  access_token,
  refresh_token,
  expires_at,
  is_active,
  created_at,
  updated_at
)
SELECT
  u.id,
  ma.id,
  'main',
  'test_access_token_1',
  'test_refresh_token_1',
  NOW() + INTERVAL '30 days',
  true,
  NOW(),
  NOW()
FROM auth.users u
CROSS JOIN main_accounts ma
WHERE u.email = 'test@xlo-system.com'
  AND ma.handle = 'test_main_account_1'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. Create Test Follow Accounts
-- ============================================================================

INSERT INTO follow_accounts (
  user_id,
  target_handle,
  target_name,
  followers_count,
  category,
  tags,
  created_at,
  updated_at
)
SELECT
  id,
  'test_follow_account_1',
  'Test Follow Account 1',
  5000,
  'tech',
  ARRAY['test', 'automation'],
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'test@xlo-system.com'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. Create Test Spam Accounts
-- ============================================================================

-- First, create a test proxy
INSERT INTO proxies (
  user_id,
  proxy_name,
  proxy_url,
  proxy_type,
  response_time_ms,
  is_active,
  created_at,
  updated_at
)
SELECT
  id,
  'Test Proxy 1',
  'http://test-proxy.example.com:8080',
  'http',
  150,
  true,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'test@xlo-system.com'
ON CONFLICT DO NOTHING;

-- Create spam accounts
INSERT INTO spam_accounts (
  user_id,
  handle,
  name,
  proxy_id,
  tags,
  created_at,
  updated_at
)
SELECT
  u.id,
  'test_spam_account_1',
  'Test Spam Account 1',
  p.id,
  ARRAY['test', 'spam'],
  NOW(),
  NOW()
FROM auth.users u
CROSS JOIN proxies p
WHERE u.email = 'test@xlo-system.com'
  AND p.proxy_name = 'Test Proxy 1'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. Create Test Templates
-- ============================================================================

INSERT INTO templates (
  user_id,
  template_name,
  template_type,
  content,
  variables,
  category,
  tags,
  usage_count,
  created_at,
  updated_at
)
SELECT
  id,
  'Test Post Template 1',
  'post',
  'これはテスト投稿です。{{date}}に自動投稿されました。 #test',
  ARRAY['date'],
  'test',
  ARRAY['automation', 'test'],
  0,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'test@xlo-system.com'
ON CONFLICT DO NOTHING;

INSERT INTO templates (
  user_id,
  template_name,
  template_type,
  content,
  variables,
  category,
  tags,
  created_at,
  updated_at
)
SELECT
  id,
  'Test Reply Template 1',
  'reply',
  '@{{handle}} こんにちは！素晴らしい投稿ですね。',
  ARRAY['handle'],
  'test',
  ARRAY['engagement', 'test'],
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'test@xlo-system.com'
ON CONFLICT DO NOTHING;

INSERT INTO templates (
  user_id,
  template_name,
  template_type,
  content,
  variables,
  tags,
  created_at,
  updated_at
)
SELECT
  id,
  'Test DM Template 1',
  'dm',
  'こんにちは{{name}}さん！フォローありがとうございます。',
  ARRAY['name'],
  ARRAY['dm', 'test'],
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'test@xlo-system.com'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. Create Test Loops
-- ============================================================================

INSERT INTO loops (
  user_id,
  loop_name,
  description,
  execution_interval_hours,
  min_accounts,
  max_accounts,
  executor_account_ids,
  allowed_account_tags,
  reply_template_id,
  is_active,
  created_at,
  updated_at
)
SELECT
  u.id,
  'Test Post Loop 1',
  'Test loop for E2E testing',
  2,
  1,
  1,
  ARRAY[sa.id],
  ARRAY['test'],
  t.id,
  false,
  NOW(),
  NOW()
FROM auth.users u
CROSS JOIN templates t
CROSS JOIN spam_accounts sa
WHERE u.email = 'test@xlo-system.com'
  AND t.template_name = 'Test Reply Template 1'
  AND sa.handle = 'test_spam_account_1'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. Create Test Auto Engagement Rules
-- ============================================================================

INSERT INTO auto_engagement_rules (
  user_id,
  name,
  search_type,
  search_keywords,
  action_type,
  reply_template_id,
  min_followers,
  max_followers,
  min_account_age_days,
  exclude_keywords,
  require_verified,
  max_actions_per_execution,
  daily_limit,
  actions_today,
  is_active,
  created_at,
  updated_at
)
SELECT
  u.id,
  'Test Engagement Rule 1',
  'keyword',
  ARRAY['test', 'automation'],
  'like',
  t.id,
  100,
  10000,
  30,
  ARRAY['spam', 'bot'],
  false,
  10,
  50,
  0,
  false,
  NOW(),
  NOW()
FROM auth.users u
CROSS JOIN templates t
WHERE u.email = 'test@xlo-system.com'
  AND t.template_name = 'Test Reply Template 1'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. Create Test DM Rules
-- ============================================================================

INSERT INTO dm_send_rules (
  user_id,
  name,
  account_token_id,
  template_id,
  delay_slot_hours,
  daily_limit,
  is_active,
  created_at,
  updated_at
)
SELECT
  u.id,
  'Test DM Rule 1',
  at.id,
  t.id,
  0,
  20,
  false,
  NOW(),
  NOW()
FROM auth.users u
CROSS JOIN account_tokens at
CROSS JOIN templates t
WHERE u.email = 'test@xlo-system.com'
  AND at.account_type = 'main'
  AND t.template_name = 'Test DM Template 1'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify test data was created
DO $$
DECLARE
  user_count int;
  app_count int;
  account_count int;
  template_count int;
  loop_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users WHERE email = 'test@xlo-system.com';
  SELECT COUNT(*) INTO app_count FROM twitter_apps WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'test@xlo-system.com');
  SELECT COUNT(*) INTO account_count FROM main_accounts WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'test@xlo-system.com');
  SELECT COUNT(*) INTO template_count FROM templates WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'test@xlo-system.com');
  SELECT COUNT(*) INTO loop_count FROM loops WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'test@xlo-system.com');

  RAISE NOTICE '=== Test Data Seeding Complete ===';
  RAISE NOTICE 'Test Users: %', user_count;
  RAISE NOTICE 'Twitter Apps: %', app_count;
  RAISE NOTICE 'Main Accounts: %', account_count;
  RAISE NOTICE 'Templates: %', template_count;
  RAISE NOTICE 'Loops: %', loop_count;
  RAISE NOTICE '================================';
END $$;
