# XLO System - Missing Features Summary

## Quick Overview

This document summarizes what's **MISSING** or **INCOMPLETE** across all 6 requirement categories.

---

## CRITICAL GAPS (Implement First)

### 1. Media File Upload (投稿管理)
- **MISSING:** File upload functionality
- **Current:** Only URLs accepted  
- **File:** `components/posts/PostForm.tsx`
- **Impact:** HIGH - Core feature

### 2. Real-time Engagement Tracking (投稿管理)
- **MISSING:** Live engagement metrics (likes, retweets, replies)
- **Current:** Static engagement_count field only
- **File:** `app/posts/page.tsx`
- **Impact:** HIGH - User visibility feature

### 3. X Advanced Search Operators (エンゲージメント)
- **MISSING:** since:, until:, filter:has_engagement, min_retweets:, min_faves:, min_replies:
- **Current:** Basic keyword/hashtag/user searches only
- **File:** `supabase/functions/execute-auto-engagement/index.ts`
- **Impact:** HIGH - Major feature limitation

### 4. CTA Auto-Trigger (ループ管理)
- **MISSING:** Post detection + immediate CTA reply execution
- **Current:** CTA template type exists but no execution
- **Files:** No trigger mechanism exists
- **Impact:** HIGH - Core automation feature

---

## IMPORTANT GAPS (Implement Next)

### 5. Hourly Scheduling Defaults (投稿管理)
- **MISSING:** Per-account default scheduling intervals (should default to 1 hour)
- **Current:** Must set schedule manually each time
- **Status:** No database schema for defaults

### 6. Category/Tag Management (テンプレート管理)
- **MISSING:** Management UI to view, edit, delete categories and tags
- **Current:** Can add free-text categories/tags, but no management page
- **Status:** No management interface

### 7. Proxy Auto-Assignment (プロキシ)
- **MISSING:** Automatic proxy assignment to accounts
- **Current:** Proxies exist but not used anywhere
- **Status:** No account-to-proxy mapping

### 8. Auto-Unfollow (エンゲージメント)
- **MISSING:** N-weeks-after auto-unfollow functionality
- **Current:** One-way following only
- **Status:** Complete feature missing

---

## PARTIAL IMPLEMENTATIONS (Need Completion)

### 9. Follow Account Priority (フォローアカウント)
- **PARTIALLY DONE:** Priority field exists (1-10 scale)
- **MISSING:** Integration with engagement execution
- **Current:** Priority is stored but not used during follow actions
- **Status:** Need to integrate priority into execute-auto-engagement

### 10. Search-based Loop Replies (ループ管理)
- **ARCHITECTURE ISSUE:** Loops and Engagement Rules are separate
  - Loops = scheduled template posting
  - Engagement Rules = search-based actions + replies
- **MISSING:** Loops have NO search_query or search_type fields
- **Current:** Only engagement rules support search-based replies
- **Note:** May be working as designed (not a bug)

---

## REQUIREMENT CONTRADICTIONS

### 11. Template Variables (テンプレート管理)
- **REQUIREMENT:** "変数を設定することはできません" (Variables should NOT be settable)
- **CURRENT IMPLEMENTATION:** Variables ARE settable and functional
- **ACTION NEEDED:** Clarify with stakeholder
  - Should variables be REMOVED? OR
  - Should requirements be updated?

---

## NOT STARTED

### 12. Multi-account Follow via URL (フォローアカウント)
- **STATUS:** NOT IMPLEMENTED
- **FEATURE:** Specify account URL to follow across multiple executor accounts
- **IMPACT:** LOW - Convenience feature

---

## Implementation Checklist

### Phase 2 (Critical - Must Have)
- [ ] Media file upload with preview
- [ ] Real-time engagement polling
- [ ] Advanced X search operators (since:, until:, filter:, min_*:)
- [ ] CTA trigger mechanism + execution

### Phase 3 (Important - Should Have)
- [ ] Hourly scheduling defaults per account
- [ ] Category/Tag management UI
- [ ] Proxy account assignment mapping
- [ ] Auto-unfollow after N weeks

### Phase 4 (Nice to Have)
- [ ] URL-based multi-account follow
- [ ] Priority-based follow extraction integration

---

## File Reference Guide

**Post Management:**
- `components/posts/PostForm.tsx` - Media upload, scheduling
- `app/posts/page.tsx` - Real-time engagement display

**Templates:**
- `components/templates/TemplateForm.tsx` - Variables, categories, tags

**Engagement:**
- `app/engagement/page.tsx` - Engagement rules UI
- `supabase/functions/execute-auto-engagement/index.ts` - Search implementation

**Loops:**
- `components/loops/LoopForm.tsx` - Loop configuration
- `supabase/functions/execute-loop/index.ts` - Loop execution

**Follow Accounts:**
- `components/accounts/FollowAccountForm.tsx` - Priority field
- `app/accounts/follow/page.tsx` - List sorting by priority

**Proxies:**
- `components/proxies/ProxyForm.tsx` - Proxy configuration

---

## Quick Stats

- **Total Requirements Checked:** 13
- **IMPLEMENTED:** 1 (reply delay min/max)
- **PARTIALLY IMPLEMENTED:** 3 (priority, search-based replies, categories/tags)
- **NOT IMPLEMENTED:** 8
- **CONTRADICTORY:** 1 (variables)

**Overall Completion:** ~30%
