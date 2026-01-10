#!/bin/bash

# ============================================================================
# E2E Test Data Seeding Script
# Purpose: Seed database with test data for E2E tests
# ============================================================================

set -e

echo "🌱 Starting E2E test data seeding..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.test.local exists
if [ ! -f .env.test.local ]; then
  echo -e "${RED}❌ Error: .env.test.local not found${NC}"
  exit 1
fi

# Load environment variables
source .env.test.local

# Extract database credentials from DATABASE_URL
# Format: postgresql://postgres:postgres@127.0.0.1:54322/postgres
DB_USER=$(echo $DATABASE_URL | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')

echo "📊 Database Connection Info:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check if test user exists
echo "🔍 Checking if test user exists..."
USER_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc \
  "SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = '$TEST_USER_EMAIL');")

if [ "$USER_EXISTS" = "f" ]; then
  echo -e "${YELLOW}⚠️  Test user does not exist. Creating test user...${NC}"

  # Create test user using Supabase Admin API
  # Note: This requires SUPABASE_SERVICE_ROLE_KEY to be set
  if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Error: SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    echo "Please set SUPABASE_SERVICE_ROLE_KEY in .env.test.local"
    exit 1
  fi

  # Create user via SQL (simpler for local dev)
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<-EOSQL
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      '$TEST_USER_EMAIL',
      crypt('$TEST_USER_PASSWORD', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    )
    ON CONFLICT (email) DO NOTHING;

    -- Also create identity record
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      id,
      jsonb_build_object('sub', id::text, 'email', email),
      'email',
      NOW(),
      NOW(),
      NOW()
    FROM auth.users
    WHERE email = '$TEST_USER_EMAIL'
    ON CONFLICT (provider, user_id) DO NOTHING;
EOSQL

  echo -e "${GREEN}✅ Test user created${NC}"
else
  echo -e "${GREEN}✅ Test user already exists${NC}"
fi

echo ""
echo "📝 Running seed SQL file..."

# Run the seed SQL file
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  -f supabase/seed_e2e_test_data.sql

echo ""
echo -e "${GREEN}✅ E2E test data seeded successfully!${NC}"
echo ""
echo "🚀 You can now run E2E tests with:"
echo "   npm run test:e2e"
echo ""
