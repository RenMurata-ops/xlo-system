# Untracked Files Review

## Category 1: Should be Committed (Production/Feature Files)

### Configuration & Infrastructure
- `.eslintrc.json` - ESLint configuration
- `supabase/config.toml` - Supabase local configuration
- `supabase/functions/_shared/cors.ts` - CRITICAL: Fail-safe CORS utility

### Edge Functions (Already Deployed)
- `supabase/functions/check-rules/` - Debug function
- `supabase/functions/check-tokens/` - Debug function
- `supabase/functions/check-twitter-app/` - Debug function
- `supabase/functions/check-user-rule/` - Debug function
- `supabase/functions/clear-token-error/` - Utility function
- `supabase/functions/debug-rules/` - Debug function
- `supabase/functions/debug-token/` - Debug function
- `supabase/functions/delete-bearer-token/` - Utility function
- `supabase/functions/detect-followbacks/` - Feature function
- `supabase/functions/disable-invalid-rule/` - Utility function
- `supabase/functions/dispatch-dms/` - Feature function
- `supabase/functions/fix-token-type/` - Utility function
- `supabase/functions/force-activate-token/` - Utility function
- `supabase/functions/insert-bearer-token/` - Utility function
- `supabase/functions/refresh-token/` - Core function
- `supabase/functions/refresh-twitter-token/` - Core function
- `supabase/functions/test-single-rule/` - Debug function
- `supabase/functions/update-twitter-callback/` - Utility function

### Database Migrations
- `supabase/migrations/20251219_auto_dm_followback.sql` - DM feature
- `supabase/migrations/20260106_fix_proxies_ui.sql` - UI fix
- `supabase/migrations/20260107_add_twitter_app_id_to_tokens.sql` - Schema fix
- `supabase/migrations/20260107_encrypt_sensitive_data.sql` - Security feature
- `supabase/migrations/20260107_schedule_refresh_tokens.sql` - Cron job setup
- `supabase/migrations/20260108_add_notes_to_follow_accounts.sql` - Feature addition

### New Features
- `app/dm-rules/` - DM rules UI (new feature)
- `components/dm/` - DM components (new feature)

### Operational Documentation
- `OPERATIONS_GUIDE.md` - CRITICAL: Token management operations guide

---

## Category 2: Should be Deleted (Temporary/Debug Files)

### One-Time Debug Queries
- `CHECK_CRON_AND_PGNET.sql`
- `CHECK_TOKEN_AND_RULES.sql`
- `CHECK_TOKEN_EXPIRY.sql`
- `CHECK_TOKEN_STATUS.sql`
- `CHECK_TWITTER_APP.sql`
- `CHECK_TWITTER_APPS_SCHEMA.sql`
- `CHECK_USER_RULE.sql`
- `COMPREHENSIVE_SCHEMA_CHECK.sql`
- `GET_ALL_SCHEMAS_COMPREHENSIVE.sql`
- `GET_ALL_TABLE_SCHEMAS.sql`
- `VERIFY_CRON_FIX.sql`
- `VERIFY_SCHEMA_FIXES.sql`

### One-Time Fix Scripts
- `FIX_ADDITIONAL_SCHEMA_MISMATCHES.sql`
- `FIX_ALL_CRITICAL_ISSUES.sql`
- `FIX_ALL_CRITICAL_ISSUES_V2.sql`
- `FIX_ALL_REMAINING_SCHEMA_ISSUES.sql`
- `FIX_ALL_SCHEMA_MISMATCHES.sql`
- `FIX_CALLBACK_URL.sql`
- `FIX_CRITICAL_ISSUES.sql`
- `FIX_CRON_JOBS.sql`
- `FORCE_ACTIVATE_TOKEN.sql`
- `INSERT_BEARER_TOKEN.sql`
- `UPDATE_TWITTER_APP_CALLBACK.sql`
- `SETUP_DATABASE_CONFIG.sql`
- `setup_refresh_tokens_cron.sql`
- `delete-and-reauth-token.sql`
- `fix_cors_all_functions.py`
- `fix_cors_all_functions.sh`
- `VERIFY_FIXES.sh`

### Temporary Debug Scripts
- `check_token_status.js`
- `check_tokens_direct.js`

### Temporary Reports
- `COMPREHENSIVE_ERROR_VERIFICATION_REPORT.md`
- `CRITICAL_FIXES_COMPLETE.md`
- `CRITICAL_FIXES_REPORT.md`
- `CRITICAL_SCHEMA_ISSUES_REPORT.md`
- `EXECUTE_SCHEMA_FIXES.md`
- `FINAL_FIXES_COMPLETE.md`
- `SCHEMA_AUDIT_COMPLETE.md`
- `SCHEMA_FIXES_SUCCESS.md`
- `SCHEMA_MISMATCH_REPORT.md`
- `SCHEMA_VERIFICATION_REPORT.md`

---

## Category 3: Keep as Documentation (Optional)

These files document setup processes and could be useful for future reference:
- `OAUTH2_INSTRUCTIONS.md` - OAuth2 setup instructions
- `OAUTH2_SETUP_COMPLETE.md` - OAuth2 setup completion status
- `PROMPT_FOR_CLAUDE_CHROME.md` - Development prompts
- `POTENTIAL_ERROR_FACTORS.md` - Error analysis documentation

**Recommendation**: Move these to a `docs/archive/` directory if keeping them.

---

## Recommended Actions

### 1. Commit Production Files
```bash
git add .eslintrc.json
git add OPERATIONS_GUIDE.md
git add supabase/config.toml
git add supabase/functions/_shared/cors.ts
git add supabase/functions/check-rules/
git add supabase/functions/check-tokens/
git add supabase/functions/check-twitter-app/
git add supabase/functions/check-user-rule/
git add supabase/functions/clear-token-error/
git add supabase/functions/debug-rules/
git add supabase/functions/debug-token/
git add supabase/functions/delete-bearer-token/
git add supabase/functions/detect-followbacks/
git add supabase/functions/disable-invalid-rule/
git add supabase/functions/dispatch-dms/
git add supabase/functions/fix-token-type/
git add supabase/functions/force-activate-token/
git add supabase/functions/insert-bearer-token/
git add supabase/functions/refresh-token/
git add supabase/functions/refresh-twitter-token/
git add supabase/functions/test-single-rule/
git add supabase/functions/update-twitter-callback/
git add supabase/migrations/
git add app/dm-rules/
git add components/dm/
```

### 2. Delete Temporary Files
```bash
rm CHECK_*.sql
rm FIX_*.sql
rm GET_ALL_*.sql
rm VERIFY_*.sql
rm VERIFY_*.sh
rm *_REPORT.md
rm *_COMPLETE.md
rm EXECUTE_SCHEMA_FIXES.md
rm check_token_status.js
rm check_tokens_direct.js
rm delete-and-reauth-token.sql
rm fix_cors_all_functions.py
rm fix_cors_all_functions.sh
rm SETUP_DATABASE_CONFIG.sql
rm setup_refresh_tokens_cron.sql
rm FORCE_ACTIVATE_TOKEN.sql
rm INSERT_BEARER_TOKEN.sql
rm UPDATE_TWITTER_APP_CALLBACK.sql
```

### 3. Archive Documentation (Optional)
```bash
mkdir -p docs/archive
mv OAUTH2_*.md docs/archive/
mv PROMPT_FOR_CLAUDE_CHROME.md docs/archive/
mv POTENTIAL_ERROR_FACTORS.md docs/archive/
git add docs/archive/
```

---

**Summary**:
- **25 production files** to commit (functions, migrations, features, docs)
- **32 temporary files** to delete (debug queries, one-time scripts, reports)
- **4 documentation files** to optionally archive
