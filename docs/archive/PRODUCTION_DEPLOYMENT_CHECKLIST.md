# XLO System - Production Deployment Checklist

**Status**: Ready for Production
**Date**: 2025-11-17

---

## ✅ Pre-Deployment Verification

### Code & Build
- [x] All STAGE1-6 features implemented
- [x] Build successful (no TypeScript errors)
- [x] All components tested
- [x] Vercel deployment successful
- [x] Git repository clean

### Documentation
- [x] README.md updated
- [x] STAGE6_COMPLETION_SUMMARY.md created
- [x] All STAGE implementation guides available
- [x] DEPLOY.md available

---

## 📋 Production Deployment Steps

### Step 1: Database Setup (Supabase)

#### 1.1 Apply Migrations

Navigate to **Supabase Dashboard > SQL Editor** and run each migration file in order:

```sql
-- 1. Initial Schema (if not already applied)
-- File: supabase/migrations/20251110_initial_schema.sql

-- 2. Missing Tables
-- File: supabase/migrations/20251112_002_add_missing_tables.sql

-- 3. Bulk Post Queue
-- File: supabase/migrations/20251112_003_add_bulk_post_queue.sql

-- 4. Hardening & Security
-- File: supabase/migrations/20251112_004_hardening.sql

-- 5. Auto Engagement
-- File: supabase/migrations/20251116_auto_engagement.sql

-- 6. Templates Table (NEW)
-- File: supabase/migrations/20251117_add_templates_table.sql

-- 7. Proxy Auto-Assignment (NEW)
-- File: supabase/migrations/20251117_proxy_auto_assignment.sql
```

**Alternative: Supabase CLI**
```bash
supabase db push
```

#### 1.2 Verify Database

Run verification queries:
```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- Check functions
SELECT proname
FROM pg_proc
WHERE proname LIKE '%engagement%'
   OR proname LIKE '%proxy%';

-- Check views
SELECT viewname
FROM pg_views
WHERE schemaname = 'public';
```

Expected tables (27+):
- account_tokens
- main_accounts
- spam_accounts
- follow_accounts
- posts
- templates (NEW)
- twitter_apps
- proxies
- nordvpn_accounts
- auto_engagement_rules
- auto_engagement_executions
- loops
- loop_executions
- bulk_post_queue
- rate_limits
- loop_locks
- duplicate_posts
- And more...

---

### Step 2: Edge Functions Deployment (Supabase)

Deploy all 7 Edge Functions:

```bash
cd ~/Downloads/xlo-system

# 1. Twitter API Proxy
supabase functions deploy twitter-api-proxy

# 2. Twitter OAuth Start
supabase functions deploy twitter-oauth-start

# 3. Twitter OAuth Callback
supabase functions deploy twitter-oauth-callback-v2

# 4. Execute Bulk Posts
supabase functions deploy execute-bulk-posts

# 5. Execute Loop
supabase functions deploy execute-loop

# 6. Schedule Loop Execution (Cron)
supabase functions deploy schedule-loop-execution

# 7. Execute Auto Engagement
supabase functions deploy execute-auto-engagement
```

#### Verify Deployment

```bash
# List deployed functions
supabase functions list
```

Expected output:
```
twitter-api-proxy
twitter-oauth-start
twitter-oauth-callback-v2
execute-bulk-posts
execute-loop
schedule-loop-execution
execute-auto-engagement
```

#### Set Cron Schedule

In Supabase Dashboard:
1. Go to **Edge Functions**
2. Find `schedule-loop-execution`
3. Set schedule: `*/15 * * * *` (every 15 minutes)

---

### Step 3: Environment Variables (Vercel)

Verify all environment variables are set in **Vercel Dashboard > Settings > Environment Variables**:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://swyiwqzlmozlqircyyzr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database
DATABASE_URL=postgresql://postgres:XLO20251110%40@db.swyiwqzlmozlqircyyzr.supabase.co:5432/postgres

# Application
NEXT_PUBLIC_APP_URL=https://xlo-system-pfug6hpr4-sakamoto334422-gmailcoms-projects.vercel.app
ADMIN_EMAIL=sakasho0123@gmail.com

# Optional: Twitter API Keys (if using official API)
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
```

---

### Step 4: Initial Data Setup

#### 4.1 Create Admin Account

1. Navigate to your deployed app
2. Go to `/auth/login`
3. Sign up with admin email: `sakasho0123@gmail.com`
4. Verify email if required

#### 4.2 Add Twitter Apps

1. Go to `/twitter-apps`
2. Click "新規登録"
3. Add your Twitter Apps credentials:
   - App name
   - Client ID
   - Client Secret
   - Bearer token (optional)
   - Marks as active

**Minimum required**: 1 Twitter App

#### 4.3 Add Proxies (NordVPN)

1. Go to `/proxies`
2. Click "新規登録"
3. Add NordVPN proxy details:
   - Proxy name (e.g., "NordVPN US East 1")
   - Server (e.g., "us1234.nordvpn.com")
   - Port (e.g., 1080)
   - Username
   - Password
   - Country
   - Mark as active

**Recommended**: 10-50 proxies for load distribution

#### 4.4 Add Main Accounts

1. Go to `/accounts/main`
2. Click "新規登録" or "CSV インポート"
3. Add main Twitter accounts:
   - Account handle (@username)
   - Account name
   - Tags (optional)

**Recommended**: 1-10 main accounts for organic posting

#### 4.5 Add Spam Accounts

1. Go to `/accounts/spam`
2. Click "CSV インポート" for bulk import
3. Add spam accounts with auto-assigned proxies:
   - Use "プロキシ一括割当" button after import
   - Assigns proxies using round-robin strategy

**Recommended**: 50-500 spam accounts

#### 4.6 Add Follow Accounts

1. Go to `/accounts/follow`
2. Click "CSV インポート"
3. Add target accounts to follow:
   - Target handle
   - Target name
   - Priority (1-10)
   - Category

**Recommended**: 100-1000 follow targets

#### 4.7 Create Templates

1. Go to `/templates`
2. Click "新規作成"
3. Create templates for:
   - **Post templates**: Generic posts
   - **Reply templates**: Reply messages with variables
   - **CTA templates**: Call-to-action messages

**Minimum required**: 10 templates (mix of post/reply/cta)

Example template with variables:
```
こんにちは {{user_name}}さん！
{{topic}}について興味深い投稿ですね。
```

---

### Step 5: Configure Auto Engagement Rules

1. Go to `/engagement`
2. Click "新規作成"
3. Create engagement rules:
   - **Search type**: keyword, hashtag, or user
   - **Search query**: e.g., "AI", "#startup", "@influencer"
   - **Action type**: like, reply, retweet, follow
   - **Filters**: Min followers, exclude keywords, etc.
   - **Executor accounts**: Select spam accounts
   - **Daily limit**: e.g., 100 actions/day
   - **Interval**: e.g., every 4 hours

**Recommended**: Start with 2-3 rules with conservative limits

---

### Step 6: Configure Loops

1. Go to `/loops`
2. Click "新規作成"
3. Create loops:
   - **Loop name**: e.g., "Daily Morning Posts"
   - **Execution interval**: e.g., 24 hours
   - **Posts**: Select from posts table
   - **Accounts**: Select main accounts
   - **Active**: Enable

**Recommended**: 1-3 loops for regular posting schedule

---

### Step 7: Testing & Verification

#### 7.1 Test Individual Features

- [ ] Login/Logout works
- [ ] Dashboard loads with stats
- [ ] Account management (CRUD operations)
- [ ] CSV import works
- [ ] Health checks work (individual & bulk)
- [ ] Proxy auto-assignment works
- [ ] Template creation & preview works
- [ ] Post creation & preview works
- [ ] Engagement rule execution works
- [ ] Loop execution works

#### 7.2 Test Edge Functions

```bash
# Test twitter-api-proxy
curl -X POST \
  "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/twitter-api-proxy" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "/2/users/me", "method": "GET", "account_id": "YOUR_ACCOUNT_ID"}'

# Test execute-auto-engagement
curl -X POST \
  "https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-auto-engagement" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

#### 7.3 Monitor Logs

In Supabase Dashboard:
1. Go to **Edge Functions > Logs**
2. Check for errors
3. Verify executions

---

### Step 8: Production Monitoring

#### Enable Monitoring

1. **Dashboard**: Monitor rate limits, loop locks, duplicates
2. **Logs**: Check Supabase Edge Function logs
3. **Vercel**: Monitor deployments and errors
4. **Database**: Set up alerts for high load

#### Key Metrics to Monitor

- Rate limit warnings (remaining < 30%)
- Failed executions
- Duplicate post attempts
- Account ban status
- Proxy health (failure_count)

---

## 🔒 Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Service role key kept secure (server-side only)
- [ ] Admin email verified
- [ ] Strong passwords for all accounts
- [ ] Proxy credentials encrypted
- [ ] Rate limits configured appropriately
- [ ] CORS configured for production domain

---

## 🚨 Troubleshooting

### Issue: Migrations fail

**Solution**: Apply migrations one by one, check for existing objects

```sql
-- Check if table exists before creating
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'templates'
);
```

### Issue: Edge Functions not executing

**Solution**: Check logs, verify environment variables

```bash
supabase functions list
supabase functions inspect execute-auto-engagement --logs
```

### Issue: RLS blocking queries

**Solution**: Verify auth.uid() matches user_id

```sql
-- Test RLS policy
SELECT auth.uid(); -- Should return your user ID
SELECT * FROM main_accounts WHERE user_id = auth.uid();
```

### Issue: Proxy assignment fails

**Solution**: Ensure active proxies exist

```sql
SELECT * FROM proxies WHERE is_active = true;
```

---

## 📊 Success Criteria

Production deployment is successful when:

- ✅ All 27+ tables exist in database
- ✅ All 7 Edge Functions deployed
- ✅ RLS policies active on all tables
- ✅ Admin can login and access dashboard
- ✅ Can create accounts, templates, posts
- ✅ Can execute engagement rules
- ✅ Can execute loops
- ✅ Monitoring dashboards show data
- ✅ No errors in logs
- ✅ Proxy auto-assignment works

---

## 🎯 Next Steps After Deployment

1. **Scale gradually**: Start with 10-50 accounts, scale to 500
2. **Monitor closely**: Watch for rate limits and bans
3. **Adjust limits**: Fine-tune daily limits and intervals
4. **Add templates**: Create diverse template library
5. **Optimize**: Analyze statistics and optimize strategy

---

## 📞 Support

For deployment issues:
- Check logs in Supabase Dashboard
- Check Vercel deployment logs
- Review STAGE6_COMPLETION_SUMMARY.md
- Email: sakasho0123@gmail.com

---

**Generated**: 2025-11-17
**Version**: 1.0.0
**Status**: Production Ready ✅
