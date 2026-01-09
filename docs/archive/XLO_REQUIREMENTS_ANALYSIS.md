# XLO System - Requirements Analysis Report

## Executive Summary
The XLO System implementation is in **Phase 1** and contains substantial foundational features. However, several key requirements are **NOT IMPLEMENTED** or only **PARTIALLY IMPLEMENTED**. This report identifies 15+ missing or incomplete features across all requirement categories.

---

## 1. 投稿管理 (Post Management)

### 1.1 メディアアップロード形式 (Media Upload)
**STATUS: NOT IMPLEMENTED** ❌

**Current State:**
- `/components/posts/PostForm.tsx` (lines 199-211)
- Media input accepts URLs only: `media_urls` textarea for entering line-separated URLs
- No file upload capability exists
- Implementation uses string array: `media_urls: string[] | null`

**Missing:**
- HTML file input element (`<input type="file">`)
- Binary file handling
- Multipart form data support
- File upload to storage (Supabase Storage or similar)
- File validation (image types, size limits)
- Preview of uploaded images
- Progress tracking

**Impact:** Users cannot upload actual media files - only URL references work

---

### 1.2 予約投稿 - 「各アカウントごとに1時間おき」デフォルト設定
**STATUS: NOT IMPLEMENTED** ❌

**Current State:**
- PostForm has `scheduled_at` (datetime-local input)
- LoopForm has `execution_interval_hours` (default: 24)
- No per-account scheduling defaults

**Missing:**
- Database schema for per-account default scheduling intervals
- UI to set default scheduling intervals per account
- Automatic application of 1-hour default when creating scheduled posts
- System logic to enforce per-account scheduling

**Impact:** No automation for hourly scheduling defaults - must be set manually each time

---

### 1.3 リアルタイムエンゲージメント確認 (Real-time Engagement Tracking)
**STATUS: NOT IMPLEMENTED** ❌

**Current State:**
- `posts` table has `engagement_count` field (nullable)
- `/app/posts/page.tsx` displays but doesn't track real-time metrics
- No polling mechanism
- No WebSocket connection

**Missing:**
- Real-time likes counter
- Real-time retweet counter  
- Real-time reply counter
- Engagement metrics refresh mechanism
- Live updates (polling or WebSockets)
- Engagement history/analytics
- Dashboard widgets showing engagement changes

**Impact:** Users cannot monitor engagement metrics as posts go live - only static stored numbers

---

## 2. テンプレート管理 (Template Management)

### 2.1 変数サポート削除
**STATUS: IMPLEMENTED BUT CONTRADICTORY** ⚠️

**Current State:**
- `/components/templates/TemplateForm.tsx` (lines 192-206)
- Variables field IS present and functional
- Form handles: `variables: string[] | null`
- Template database stores variables
- Instructions show: "変数は {{variable_name}} の形式で使用できます"

**Issue:**
- Requirements state: "変数を設定することはできません" (Variables should NOT be settable)
- Current implementation DOES allow variable setting
- This appears to be a requirement misalignment OR variables should be removed

**Action Required:** Clarify if variables should be:
1. Removed entirely, OR
2. Kept as-is (current implementation is correct)

---

### 2.2 カテゴリとタグのユーザー自由編集・追加・削除機能
**STATUS: PARTIALLY IMPLEMENTED** ⚠️

**Current State:**
- `/components/templates/TemplateForm.tsx` (lines 208-231)
- Category: Text input field (lines 212-218) - user can enter any value
- Tags: Comma-separated text field (lines 225-231) - user can add any values
- Both support create and update operations

**Missing:**
- NO predefined category/tag list management interface
- NO category/tag edit/delete functionality
- NO category/tag reusability across templates
- NO ability to view all categories/tags
- NO ability to delete a category/tag (only through template deletion)
- NO hierarchical category support
- NO tag suggestions/autocomplete

**Current Capability:**
- Users can enter custom category/tag values freely
- But NO management page to view/edit/delete existing categories/tags

**Impact:** Categories and tags work as free text, but no management interface exists

---

## 3. ループ管理 (Loop Management)

### 3.1 リプライテンプレートでの検索条件に基づくリプライ
**STATUS: PARTIALLY IMPLEMENTED** ⚠️

**Current State:**
- `/app/engagement/page.tsx` - Engagement rules (separate from loops)
- Engagement rules support:
  - Search types: keyword, hashtag, user, URL (lines 13)
  - Reply templates selection (lines 20, 315-334)
  - Execute-auto-engagement function builds Twitter queries

**Missing from LoopForm (`/components/loops/LoopForm.tsx`):**
- NO search_type field
- NO search_query field
- NO reply trigger conditions
- Loop is for POSTING, not for REPLYING to search results
- Reply template execution without search conditions

**Architecture Issue:**
- Loops and Engagement Rules are SEPARATE features
- Loops = scheduled template-based posting
- Engagement Rules = search-based automated actions
- Loops do NOT inherently support search-based replies

**Impact:** Loops cannot execute replies based on search conditions (Engagement Rules do this separately)

---

### 3.2 CTAテンプレートでの投稿検知時の即時CTAリプライ自動化
**STATUS: NOT IMPLEMENTED** ❌

**Current State:**
- CTA template type exists in database schema
- No execution mechanism for CTA templates
- No post detection/monitoring
- No automatic reply trigger

**Missing:**
- Monitoring for specific posts/keywords
- Trigger mechanism (real-time detection)
- Immediate auto-reply execution
- WebSocket or polling for post detection
- CTA execution function

**Impact:** CTA templates exist but cannot be automatically triggered

---

### 3.3 リプライ遅延の「最小分数・最大分数」設定
**STATUS: IMPLEMENTED** ✓

**Current State:**
- `/components/loops/LoopForm.tsx` (lines 256-281)
- `reply_delay_min_minutes` and `reply_delay_max_minutes` fields present
- Form inputs for both min/max (lines 258-280)
- Stored in database

**Status:** Fully implemented for Loops

---

## 4. エンゲージメント (Engagement)

### 4.1 「n週間後に自動アンフォロー」機能
**STATUS: NOT IMPLEMENTED** ❌

**Current State:**
- No unfollow-related code found
- No time-based unfollow mechanism
- No unfollow scheduling

**Missing:**
- Database table for tracking follow dates/relationships
- Unfollow scheduling logic
- Time-based trigger (n weeks after follow)
- Unfollow execution function
- UI to set unfollow timeframes
- Management page for follows

**Impact:** One-way following only - no auto-unfollow capability

---

### 4.2 X検索コマンド完全実装
**STATUS: PARTIALLY IMPLEMENTED** ⚠️

**Current State:**
- `/supabase/functions/execute-auto-engagement/index.ts` (lines 228-293)
- Search implementation for: keyword, hashtag, user, URL

**Implemented:**
- Basic keyword search ✓
- Hashtag search ✓
- User tweets search ✓
- URL search - NOT in search function ✗

**NOT IMPLEMENTED - Advanced Twitter Search Operators:**
- `since:` date filter ✗
- `until:` date filter ✗
- `filter:has_engagement` ✗
- `min_retweets:` ✗
- `min_faves:` ✗
- `min_replies:` ✗
- Negative filters (`-min_retweets:500`) ✗
- Combined filters ✗

**Current Query Building (lines 237-239):**
```typescript
query: rule.search_query,  // Direct string only
```

**Missing:**
- Query parameter parsing for advanced operators
- Dynamic query construction with operators
- Engagement-based filtering
- Date range filtering
- Multi-condition filtering

**Impact:** Only basic keyword/hashtag/user searches work; advanced filtering unavailable

---

## 5. フォローアカウント (Follow Accounts)

### 5.1 エンゲージメント時の優先的抽出ロジック
**STATUS: PARTIALLY IMPLEMENTED** ⚠️

**Current State:**
- `/components/accounts/FollowAccountForm.tsx` (lines 170-186)
- Priority field exists (1-10 scale)
- `/app/accounts/follow/page.tsx` sorts by priority (line: `.order('priority', { ascending: false })`)

**Missing:**
- Dynamic selection during engagement execution
- Weighted probability based on priority score
- Integration with engagement execution (execute-auto-engagement)
- Priority-based account filtering in engagement rules
- High-priority account extraction logic

**Current State:**
- Priority is settable and queryable
- BUT engagement rules don't USE priority when selecting follow targets

**Impact:** Priority exists but isn't used during automated follow actions

---

### 5.2 特定アカウントのホームURLを指定して複数アカウントでフォロー
**STATUS: NOT IMPLEMENTED** ❌

**Current State:**
- FollowAccountForm takes only:
  - target_handle (username)
  - target_name
  - target_follower_count
  - No URL field

**Missing:**
- Homepage/profile URL field
- Multi-account follow coordination
- Bulk follow from URL
- Account extraction from URL
- Follow distribution logic

**Impact:** Cannot follow multiple accounts via a single profile URL - must add each manually

---

## 6. プロキシ (Proxy)

### 6.1 メインアカウント以外への自動適用設定
**STATUS: NOT IMPLEMENTED** ❌

**Current State:**
- `/components/proxies/ProxyForm.tsx` - Basic proxy configuration only
- Fields: name, type (http/https/socks5), host, port, username, password, country, notes
- No account assignment fields

**Missing:**
- Account assignment interface (which accounts use which proxy)
- Automatic proxy assignment logic
- Proxy selection mechanism during execution
- Proxy pool management
- Account-to-proxy mapping table
- Assignment strategy (random, round-robin, by tag, etc.)

**Current Behavior:**
- Proxies are stored but not assigned to accounts
- No proxy usage during API calls
- No auto-selection

**Impact:** Proxies exist but are not used by any accounts

---

## Summary Table

| Requirement | Category | Status | Priority |
|---|---|---|---|
| Media file upload | Posts | NOT IMPLEMENTED | HIGH |
| Hourly scheduling defaults | Posts | NOT IMPLEMENTED | MEDIUM |
| Real-time engagement metrics | Posts | NOT IMPLEMENTED | HIGH |
| Variable support clarity | Templates | PARTIAL/CONFLICT | MEDIUM |
| Category/Tag management UI | Templates | PARTIAL | MEDIUM |
| Search-based loop replies | Loops | PARTIAL | HIGH |
| CTA auto-trigger mechanism | Loops | NOT IMPLEMENTED | HIGH |
| Reply delay min/max | Loops | IMPLEMENTED | - |
| Auto-unfollow (n weeks) | Engagement | NOT IMPLEMENTED | MEDIUM |
| Advanced X search operators | Engagement | PARTIAL | HIGH |
| Priority-based extraction | Follow Accounts | PARTIAL | MEDIUM |
| Multi-account follow via URL | Follow Accounts | NOT IMPLEMENTED | LOW |
| Proxy auto-assignment | Proxy | NOT IMPLEMENTED | MEDIUM |

---

## Implementation Complexity Assessment

### HIGH PRIORITY (Core Features)
1. **Media file uploads** - Requires storage setup + file handling
2. **Real-time engagement tracking** - Requires polling/webhooks
3. **Advanced X search filters** - Query parsing + API integration
4. **CTA auto-trigger** - Real-time monitoring + execution

### MEDIUM PRIORITY (Important but Secondary)
1. **Hourly scheduling defaults** - Database + UI changes
2. **Category/Tag management** - CRUD interface
3. **Proxy assignment** - Assignment logic + account linking
4. **Search-based loop replies** - Architecture refinement

### LOW PRIORITY (Nice-to-have)
1. **Multi-account follow via URL** - Convenience feature
2. **Auto-unfollow timing** - Requires follow tracking

---

## Recommendations

1. **Immediately clarify** variables requirement (2.1) - contradicts current implementation
2. **Prioritize** media uploads (1.1) and real-time engagement (1.3) for Phase 2
3. **Separate concerns**: Loops and Engagement Rules serve different purposes; ensure users understand
4. **Search filters** (4.2) need parser implementation for advanced operators
5. **Proxy system** (6.1) needs account-to-proxy mapping architecture
6. **Follow prioritization** (5.1) needs integration with execution functions

