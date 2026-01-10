-- ============================================================================
-- E2E Test Data Seed
-- Purpose: Populate database with test data for E2E tests
-- Updated to match actual database schema
-- ============================================================================

DO $$
DECLARE
  test_user_id UUID;
  test_twitter_app_id UUID;
  test_main_account_id UUID;
  test_follow_account_id UUID;
  test_spam_account_id UUID;
  test_post_template_id UUID;
  test_cta_template_id UUID;
BEGIN
  -- Get test user ID
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'test@xlo-system.com';

  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'Test user does not exist. Please create test@xlo-system.com first.';
  END IF;

  RAISE NOTICE 'Test user ID: %', test_user_id;

  -- ============================================================================
  -- 1. Twitter Apps
  -- ============================================================================
  INSERT INTO twitter_apps (
    id,
    user_id,
    app_name,
    api_key,
    api_secret,
    bearer_token,
    description,
    is_active
  ) VALUES (
    gen_random_uuid(),
    test_user_id,
    'E2E Test App',
    'test_api_key_e2e',
    'test_api_secret_e2e',
    'test_bearer_token_e2e',
    'Test Twitter App for E2E tests',
    true
  )
  ON CONFLICT (user_id, app_name) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING id INTO test_twitter_app_id;

  RAISE NOTICE 'Created Twitter App';

  -- ============================================================================
  -- 2. Main Accounts
  -- ============================================================================
  INSERT INTO main_accounts (
    id,
    user_id,
    handle,
    name,
    followers_count,
    following_count,
    is_active,
    is_verified,
    tags
  ) VALUES (
    gen_random_uuid(),
    test_user_id,
    'test_main_account',
    'E2E Test Main Account',
    1000,
    500,
    true,
    false,
    ARRAY['test', 'e2e', 'main']
  )
  ON CONFLICT (user_id, handle) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    followers_count = EXCLUDED.followers_count,
    updated_at = NOW()
  RETURNING id INTO test_main_account_id;

  -- Insert second main account
  INSERT INTO main_accounts (
    user_id,
    handle,
    name,
    followers_count,
    following_count,
    is_active,
    is_verified,
    tags
  ) VALUES (
    test_user_id,
    'test_main_account_2',
    'E2E Test Main Account 2',
    2000,
    800,
    true,
    true,
    ARRAY['test', 'e2e', 'verified']
  )
  ON CONFLICT (user_id, handle) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    followers_count = EXCLUDED.followers_count,
    updated_at = NOW();

  RAISE NOTICE 'Created Main Accounts';

  -- ============================================================================
  -- 3. Follow Accounts
  -- ============================================================================
  INSERT INTO follow_accounts (
    user_id,
    target_handle,
    target_name,
    followers_count,
    priority,
    category,
    tags,
    is_active
  ) VALUES (
    test_user_id,
    'elonmusk',
    'Elon Musk',
    100000000,
    10,
    'Tech',
    ARRAY['test', 'e2e', 'tech'],
    true
  )
  ON CONFLICT (user_id, target_handle) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    updated_at = NOW();

  INSERT INTO follow_accounts (
    user_id,
    target_handle,
    target_name,
    followers_count,
    priority,
    category,
    tags,
    is_active
  ) VALUES (
    test_user_id,
    'jack',
    'Jack Dorsey',
    5000000,
    8,
    'Tech',
    ARRAY['test', 'e2e', 'twitter'],
    true
  )
  ON CONFLICT (user_id, target_handle) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    updated_at = NOW();

  RAISE NOTICE 'Created Follow Accounts';

  -- ============================================================================
  -- 4. Spam Accounts
  -- ============================================================================
  INSERT INTO spam_accounts (
    user_id,
    handle,
    name,
    tags,
    is_active
  ) VALUES (
    test_user_id,
    'test_spam_1',
    'E2E Test Spam Account 1',
    ARRAY['test', 'e2e', 'spam'],
    true
  )
  ON CONFLICT (user_id, handle) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  INSERT INTO spam_accounts (
    user_id,
    handle,
    name,
    tags,
    is_active
  ) VALUES (
    test_user_id,
    'test_spam_2',
    'E2E Test Spam Account 2',
    ARRAY['test', 'e2e', 'spam'],
    true
  )
  ON CONFLICT (user_id, handle) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  RAISE NOTICE 'Created Spam Accounts';

  -- ============================================================================
  -- 5. Account Tokens (for active accounts)
  -- ============================================================================
  INSERT INTO account_tokens (
    id,
    user_id,
    account_type,
    account_id,
    access_token,
    access_token_secret,
    refresh_token,
    token_type,
    expires_at,
    x_user_id,
    x_username,
    display_name,
    followers_count,
    following_count,
    is_active,
    twitter_app_id
  ) VALUES (
    gen_random_uuid(),
    test_user_id,
    'main',
    test_main_account_id,
    'test_access_token_main',
    'test_access_token_secret',
    'test_refresh_token',
    'oauth2',
    NOW() + INTERVAL '30 days',
    'test_x_user_id_main',
    'test_main_account',
    'E2E Test Main Account',
    1000,
    500,
    true,
    test_twitter_app_id
  )
  ON CONFLICT (user_id, x_user_id, account_type) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    access_token = EXCLUDED.access_token,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW();

  RAISE NOTICE 'Created Account Tokens';

  -- ============================================================================
  -- 6. Post Templates
  -- ============================================================================
  INSERT INTO post_templates (
    id,
    user_id,
    title,
    content,
    tags,
    is_active
  ) VALUES (
    gen_random_uuid(),
    test_user_id,
    'E2E Test Post Template',
    'これはE2Eテスト用の投稿テンプレートです。',
    ARRAY['test', 'e2e', 'post'],
    true
  )
  ON CONFLICT (user_id, title) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    content = EXCLUDED.content,
    updated_at = NOW()
  RETURNING id INTO test_post_template_id;

  INSERT INTO post_templates (
    user_id,
    title,
    content,
    tags,
    is_active
  ) VALUES (
    test_user_id,
    'E2E Test Post Template 2',
    '2つ目のテストテンプレートです。',
    ARRAY['test', 'e2e', 'post'],
    true
  )
  ON CONFLICT (user_id, title) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    content = EXCLUDED.content,
    updated_at = NOW();

  RAISE NOTICE 'Created Post Templates';

  -- ============================================================================
  -- 7. CTA Templates
  -- ============================================================================
  INSERT INTO cta_templates (
    id,
    user_id,
    name,
    content,
    category,
    tags,
    is_active
  ) VALUES (
    gen_random_uuid(),
    test_user_id,
    'E2E Test CTA Template',
    '詳細はこちら: https://example.com',
    'test',
    ARRAY['test', 'e2e', 'cta'],
    true
  )
  ON CONFLICT (user_id, name) DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    content = EXCLUDED.content,
    updated_at = NOW()
  RETURNING id INTO test_cta_template_id;

  RAISE NOTICE 'Created CTA Templates';

  -- ============================================================================
  -- 8. Loops (delete existing test loops first)
  -- ============================================================================
  DELETE FROM loops WHERE user_id = test_user_id AND loop_name LIKE 'E2E%';

  INSERT INTO loops (
    id,
    user_id,
    loop_name,
    description,
    executor_account_ids,
    execution_interval_hours,
    is_active,
    tags
  ) VALUES (
    gen_random_uuid(),
    test_user_id,
    'E2E Test Loop',
    'E2E test loop for automated posting',
    ARRAY[test_main_account_id],
    24,
    true,
    ARRAY['test', 'e2e']
  );

  RAISE NOTICE 'Created Loops';

  -- ============================================================================
  -- 9. Auto Engagement Rules (delete existing test rules first)
  -- ============================================================================
  DELETE FROM auto_engagement_rules WHERE user_id = test_user_id AND name LIKE 'E2E%';

  INSERT INTO auto_engagement_rules (
    id,
    user_id,
    name,
    description,
    search_type,
    search_query,
    action_type,
    is_active,
    exclude_keywords,
    min_followers,
    max_followers,
    executor_account_ids
  ) VALUES (
    gen_random_uuid(),
    test_user_id,
    'E2E Test Engagement Rule',
    'E2E test engagement rule for keyword search',
    'keyword',
    'テスト test e2e',
    'like',
    true,
    ARRAY['spam', 'bot'],
    100,
    1000000,
    ARRAY[test_main_account_id]
  );

  RAISE NOTICE 'Created Auto Engagement Rules';

  -- ============================================================================
  -- 10. DM Rules (if table exists)
  -- ============================================================================
  BEGIN
    DELETE FROM dm_send_rules WHERE user_id = test_user_id AND rule_name LIKE 'E2E%';

    INSERT INTO dm_send_rules (
      id,
      user_id,
      rule_name,
      send_timing,
      delay_slot_hours,
      daily_limit,
      is_active
    ) VALUES (
      gen_random_uuid(),
      test_user_id,
      'E2E Test DM Rule',
      'immediate',
      0,
      50,
      true
    );

    RAISE NOTICE 'Created DM Rules';
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'dm_send_rules table does not exist, skipping';
    WHEN undefined_column THEN
      RAISE NOTICE 'dm_send_rules table has different schema, skipping';
  END;

  -- ============================================================================
  -- Success Message
  -- ============================================================================
  RAISE NOTICE '✅ E2E Test data seeded successfully!';
  RAISE NOTICE 'Test User ID: %', test_user_id;
  RAISE NOTICE 'Run E2E tests with: npm run test:e2e';

END $$;
