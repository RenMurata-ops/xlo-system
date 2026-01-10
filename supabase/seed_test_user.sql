-- Simple test user creation for E2E tests
-- Email: test@xlo-system.com
-- Password: TestPassword123!

DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Check if test user already exists
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'test@xlo-system.com';

  IF test_user_id IS NULL THEN
    -- Generate a new UUID for the test user
    test_user_id := gen_random_uuid();

    -- Insert into auth.users
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
      test_user_id,
      'authenticated',
      'authenticated',
      'test@xlo-system.com',
      crypt('TestPassword123!', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Insert into auth.identities (provider_id is required, email is generated)
    INSERT INTO auth.identities (
      provider_id,
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      test_user_id::text,  -- provider_id must be set
      gen_random_uuid(),
      test_user_id,
      format('{"sub":"%s","email":"test@xlo-system.com"}', test_user_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Created test user: test@xlo-system.com (ID: %)', test_user_id;
  ELSE
    RAISE NOTICE 'Test user already exists: test@xlo-system.com (ID: %)', test_user_id;
  END IF;
END $$;
