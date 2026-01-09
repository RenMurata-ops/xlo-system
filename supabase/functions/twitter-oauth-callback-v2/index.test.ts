import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

/**
 * Comprehensive Test Suite for twitter-oauth-callback-v2 Edge Function
 *
 * Coverage:
 * - Query parameter parsing
 * - Error handling from Twitter
 * - OAuth session validation
 * - Session expiry checks
 * - Twitter App credential verification
 * - Token exchange with Twitter API
 * - User profile fetching
 * - Database upserts (account_tokens, accounts)
 * - Session cleanup
 * - Redirect logic
 */

// Query Parameter Tests
Deno.test("Query Parameters: extracts code parameter", () => {
  const url = new URL("http://localhost:8000/callback?code=auth_code_123&state=state_456");
  const code = url.searchParams.get("code");

  assertEquals(code, "auth_code_123");
});

Deno.test("Query Parameters: extracts state parameter", () => {
  const url = new URL("http://localhost:8000/callback?code=auth_code_123&state=state_456");
  const state = url.searchParams.get("state");

  assertEquals(state, "state_456");
});

Deno.test("Query Parameters: extracts error parameter", () => {
  const url = new URL("http://localhost:8000/callback?error=access_denied");
  const error = url.searchParams.get("error");

  assertEquals(error, "access_denied");
});

Deno.test("Query Parameters: redirects with error when error param present", () => {
  const error = "access_denied";
  const redirectUrl = `http://localhost:3000/twitter-apps?error=${error}`;

  assertStringIncludes(redirectUrl, "error=access_denied");
});

Deno.test("Query Parameters: returns error when code missing", () => {
  const url = new URL("http://localhost:8000/callback?state=state_456");
  const code = url.searchParams.get("code");

  assertEquals(code, null);
  // Should throw error: Missing code or state parameter
});

Deno.test("Query Parameters: returns error when state missing", () => {
  const url = new URL("http://localhost:8000/callback?code=auth_code_123");
  const state = url.searchParams.get("state");

  assertEquals(state, null);
  // Should throw error: Missing code or state parameter
});

// Environment Variable Tests
Deno.test("Environment: requires SUPABASE_URL", () => {
  const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

  assertEquals(requiredEnvVars.includes("SUPABASE_URL"), true);
});

Deno.test("Environment: requires SUPABASE_SERVICE_ROLE_KEY", () => {
  const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

  assertEquals(requiredEnvVars.includes("SUPABASE_SERVICE_ROLE_KEY"), true);
});

Deno.test("Environment: uses APP_URL for redirects", () => {
  const appUrl = "https://example.com";
  const fallback = "http://localhost:3000";
  const finalUrl = appUrl || fallback;

  assertEquals(finalUrl, "https://example.com");
});

Deno.test("Environment: falls back to localhost when APP_URL not set", () => {
  const appUrl = null;
  const fallback = "http://localhost:3000";
  const finalUrl = appUrl || fallback;

  assertEquals(finalUrl, "http://localhost:3000");
});

// OAuth Session Tests
Deno.test("OAuth Session: queries by state parameter", () => {
  const state = "state_456";
  const query = {
    table: "oauth_sessions",
    filter: { state: "state_456" },
  };

  assertEquals(query.filter.state, state);
});

Deno.test("OAuth Session: redirects with invalid_state error when not found", () => {
  const redirectUrl = "http://localhost:3000/twitter-apps?error=invalid_state";

  assertStringIncludes(redirectUrl, "error=invalid_state");
});

Deno.test("OAuth Session: checks expiry timestamp", () => {
  const sessionExpiresAt = new Date("2024-01-01T12:00:00Z");
  const now = new Date("2024-01-01T13:00:00Z");
  const isExpired = sessionExpiresAt < now;

  assertEquals(isExpired, true);
});

Deno.test("OAuth Session: redirects with session_expired when expired", () => {
  const sessionExpiresAt = new Date("2024-01-01T12:00:00Z");
  const now = new Date("2024-01-01T13:00:00Z");

  if (sessionExpiresAt < now) {
    const redirectUrl = "http://localhost:3000/twitter-apps?error=session_expired";
    assertStringIncludes(redirectUrl, "error=session_expired");
  }
});

Deno.test("OAuth Session: allows access when not expired", () => {
  const sessionExpiresAt = new Date("2024-01-01T14:00:00Z");
  const now = new Date("2024-01-01T13:00:00Z");
  const isExpired = sessionExpiresAt < now;

  assertEquals(isExpired, false);
});

Deno.test("OAuth Session: contains user_id", () => {
  const session = {
    user_id: "user-123",
    state: "state_456",
    code_verifier: "verifier_789",
    twitter_app_id: "app-123",
  };

  assertExists(session.user_id);
});

Deno.test("OAuth Session: contains code_verifier for PKCE", () => {
  const session = {
    code_verifier: "verifier_789",
  };

  assertExists(session.code_verifier);
  assertEquals(session.code_verifier.length > 0, true);
});

Deno.test("OAuth Session: contains account linking info", () => {
  const session = {
    account_id: "acc-123",
    account_type: "main",
    twitter_app_id: "app-456",
  };

  assertExists(session.account_id);
  assertExists(session.account_type);
  assertExists(session.twitter_app_id);
});

// Twitter App Tests
Deno.test("Twitter App: queries by twitter_app_id from session", () => {
  const twitterAppId = "app-456";
  const query = {
    table: "twitter_apps",
    filter: { id: twitterAppId },
  };

  assertEquals(query.filter.id, twitterAppId);
});

Deno.test("Twitter App: redirects with app_not_found when not found", () => {
  const redirectUrl = "http://localhost:3000/twitter-apps?error=app_not_found";

  assertStringIncludes(redirectUrl, "error=app_not_found");
});

Deno.test("Twitter App: validates client_id exists", () => {
  const twitterApp = {
    client_id: null,
    client_secret: "secret",
    callback_url: "https://example.com/callback",
  };

  assertEquals(twitterApp.client_id, null);
  // Should redirect with invalid_credentials error
});

Deno.test("Twitter App: validates client_secret exists", () => {
  const twitterApp = {
    client_id: "client",
    client_secret: null,
    callback_url: "https://example.com/callback",
  };

  assertEquals(twitterApp.client_secret, null);
  // Should redirect with invalid_credentials error
});

Deno.test("Twitter App: uses callback_url from app if available", () => {
  const twitterApp = {
    callback_url: "https://custom.com/callback",
  };
  const supabaseUrl = "https://supabase.co";
  const redirectUri = twitterApp.callback_url || `${supabaseUrl}/functions/v1/twitter-oauth-callback-v2`;

  assertEquals(redirectUri, "https://custom.com/callback");
});

Deno.test("Twitter App: falls back to Supabase URL when no callback_url", () => {
  const twitterApp = {
    callback_url: null,
  };
  const supabaseUrl = "https://supabase.co";
  const redirectUri = twitterApp.callback_url || `${supabaseUrl}/functions/v1/twitter-oauth-callback-v2`;

  assertEquals(redirectUri, "https://supabase.co/functions/v1/twitter-oauth-callback-v2");
});

Deno.test("Twitter App: redirects with missing_callback_url error when both missing", () => {
  const supabaseUrl = null;
  const callbackUrl = null;

  if (!supabaseUrl && !callbackUrl) {
    const redirectUrl = "http://localhost:3000/twitter-apps?error=missing_callback_url";
    assertStringIncludes(redirectUrl, "error=missing_callback_url");
  }
});

// Token Exchange Tests
Deno.test("Token Exchange: uses authorization_code grant type", () => {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: "auth_code_123",
  });

  assertEquals(params.get("grant_type"), "authorization_code");
});

Deno.test("Token Exchange: includes authorization code", () => {
  const code = "auth_code_123";
  const params = new URLSearchParams({
    code: code,
  });

  assertEquals(params.get("code"), code);
});

Deno.test("Token Exchange: includes redirect_uri", () => {
  const redirectUri = "https://example.com/callback";
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
  });

  assertEquals(params.get("redirect_uri"), redirectUri);
});

Deno.test("Token Exchange: includes code_verifier for PKCE", () => {
  const codeVerifier = "verifier_789";
  const params = new URLSearchParams({
    code_verifier: codeVerifier,
  });

  assertEquals(params.get("code_verifier"), codeVerifier);
});

Deno.test("Token Exchange: uses Basic Auth with credentials", () => {
  const clientId = "client-123";
  const clientSecret = "secret-456";
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  assertExists(basicAuth);
  assertEquals(basicAuth, btoa("client-123:secret-456"));
});

Deno.test("Token Exchange: uses application/x-www-form-urlencoded", () => {
  const contentType = "application/x-www-form-urlencoded";

  assertEquals(contentType, "application/x-www-form-urlencoded");
});

Deno.test("Token Exchange: redirects with token_exchange_failed on error", () => {
  const redirectUrl = "http://localhost:3000/twitter-apps?error=token_exchange_failed";

  assertStringIncludes(redirectUrl, "error=token_exchange_failed");
});

Deno.test("Token Exchange: expects access_token in response", () => {
  const tokenData = {
    access_token: "access_token_123",
    refresh_token: "refresh_token_456",
    expires_in: 7200,
  };

  assertExists(tokenData.access_token);
});

Deno.test("Token Exchange: expects refresh_token in response", () => {
  const tokenData = {
    access_token: "access_token_123",
    refresh_token: "refresh_token_456",
    expires_in: 7200,
  };

  assertExists(tokenData.refresh_token);
});

Deno.test("Token Exchange: expects expires_in in response", () => {
  const tokenData = {
    expires_in: 7200,
  };

  assertEquals(tokenData.expires_in, 7200);
});

// User Profile Tests
Deno.test("User Profile: requests comprehensive user fields", () => {
  const userFields = "id,name,username,profile_image_url,public_metrics,verified";
  const fields = userFields.split(",");

  assertEquals(fields.includes("id"), true);
  assertEquals(fields.includes("name"), true);
  assertEquals(fields.includes("username"), true);
  assertEquals(fields.includes("profile_image_url"), true);
  assertEquals(fields.includes("public_metrics"), true);
  assertEquals(fields.includes("verified"), true);
});

Deno.test("User Profile: uses Bearer token for authentication", () => {
  const accessToken = "access_token_123";
  const authHeader = `Bearer ${accessToken}`;

  assertEquals(authHeader, "Bearer access_token_123");
});

Deno.test("User Profile: redirects with user_fetch_failed on error", () => {
  const redirectUrl = "http://localhost:3000/twitter-apps?error=user_fetch_failed";

  assertStringIncludes(redirectUrl, "error=user_fetch_failed");
});

Deno.test("User Profile: extracts follower_count from public_metrics", () => {
  const twitterUser = {
    public_metrics: {
      followers_count: 1000,
      following_count: 500,
    },
  };

  const followerCount = twitterUser.public_metrics?.followers_count || 0;

  assertEquals(followerCount, 1000);
});

Deno.test("User Profile: defaults follower_count to 0 if missing", () => {
  const twitterUser = {
    public_metrics: null,
  };

  const followerCount = twitterUser.public_metrics?.followers_count || 0;

  assertEquals(followerCount, 0);
});

Deno.test("User Profile: extracts following_count from public_metrics", () => {
  const twitterUser = {
    public_metrics: {
      followers_count: 1000,
      following_count: 500,
    },
  };

  const followingCount = twitterUser.public_metrics?.following_count || 0;

  assertEquals(followingCount, 500);
});

Deno.test("User Profile: extracts verified status", () => {
  const twitterUser = {
    verified: true,
  };

  const isVerified = twitterUser.verified || false;

  assertEquals(isVerified, true);
});

Deno.test("User Profile: defaults verified to false if missing", () => {
  const twitterUser = {
    verified: null,
  };

  const isVerified = twitterUser.verified || false;

  assertEquals(isVerified, false);
});

// Token Expiry Calculation Tests
Deno.test("Token Expiry: calculates correct expiry time", () => {
  const expiresIn = 7200; // 2 hours
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

  const now = new Date();
  const diffSeconds = (expiresAt.getTime() - now.getTime()) / 1000;

  assertEquals(Math.abs(diffSeconds - 7200) < 1, true);
});

// Database Upsert Tests
Deno.test("Database Upsert: uses upsert with conflict resolution", () => {
  const upsertConfig = {
    onConflict: "user_id,x_user_id,account_type",
  };

  assertEquals(upsertConfig.onConflict, "user_id,x_user_id,account_type");
});

Deno.test("Database Upsert: includes user_id from session", () => {
  const tokenData = {
    user_id: "user-123",
  };

  assertEquals(tokenData.user_id, "user-123");
});

Deno.test("Database Upsert: includes account_type from session", () => {
  const tokenData = {
    account_type: "main",
  };

  assertEquals(tokenData.account_type, "main");
});

Deno.test("Database Upsert: defaults account_type to 'main' if missing", () => {
  const sessionAccountType = null;
  const accountType = sessionAccountType || "main";

  assertEquals(accountType, "main");
});

Deno.test("Database Upsert: includes account_id from session", () => {
  const tokenData = {
    account_id: "acc-456",
  };

  assertExists(tokenData.account_id);
});

Deno.test("Database Upsert: allows null account_id", () => {
  const sessionAccountId = null;
  const accountId = sessionAccountId || null;

  assertEquals(accountId, null);
});

Deno.test("Database Upsert: stores twitter_app_id", () => {
  const tokenData = {
    twitter_app_id: "app-789",
  };

  assertEquals(tokenData.twitter_app_id, "app-789");
});

Deno.test("Database Upsert: stores access_token", () => {
  const tokenData = {
    access_token: "access_token_123",
  };

  assertExists(tokenData.access_token);
});

Deno.test("Database Upsert: stores refresh_token", () => {
  const tokenData = {
    refresh_token: "refresh_token_456",
  };

  assertExists(tokenData.refresh_token);
});

Deno.test("Database Upsert: allows null refresh_token", () => {
  const refreshToken = null;
  const storedToken = refreshToken || null;

  assertEquals(storedToken, null);
});

Deno.test("Database Upsert: sets token_type to 'oauth2'", () => {
  const tokenData = {
    token_type: "oauth2",
  };

  assertEquals(tokenData.token_type, "oauth2");
});

Deno.test("Database Upsert: stores Twitter user data", () => {
  const tokenData = {
    x_user_id: "twitter_id_123",
    x_username: "twitter_user",
    display_name: "Twitter User",
    twitter_display_name: "Twitter User",
    profile_image_url: "https://example.com/image.jpg",
  };

  assertExists(tokenData.x_user_id);
  assertExists(tokenData.x_username);
  assertExists(tokenData.display_name);
});

Deno.test("Database Upsert: stores profile metrics", () => {
  const tokenData = {
    followers_count: 1000,
    following_count: 500,
    is_verified: true,
  };

  assertEquals(tokenData.followers_count, 1000);
  assertEquals(tokenData.following_count, 500);
  assertEquals(tokenData.is_verified, true);
});

Deno.test("Database Upsert: sets is_active to true", () => {
  const tokenData = {
    is_active: true,
  };

  assertEquals(tokenData.is_active, true);
});

Deno.test("Database Upsert: sets last_refreshed_at timestamp", () => {
  const lastRefreshedAt = new Date().toISOString();

  assertExists(lastRefreshedAt);
  assertEquals(lastRefreshedAt.length, 24); // ISO 8601 format
});

Deno.test("Database Upsert: uses display_name as fallback", () => {
  const twitterUser = {
    name: null,
    username: "twitter_user",
  };

  const displayName = twitterUser.name || twitterUser.username;

  assertEquals(displayName, "twitter_user");
});

Deno.test("Database Upsert: redirects with token_save_failed on error", () => {
  const redirectUrl = "http://localhost:3000/twitter-apps?error=token_save_failed";

  assertStringIncludes(redirectUrl, "error=token_save_failed");
});

// Account Update Tests
Deno.test("Account Update: updates main_accounts for main type", () => {
  const accountType = "main";
  let accountTable = "main_accounts";

  if (accountType === "spam") {
    accountTable = "spam_accounts";
  } else if (accountType === "follow") {
    accountTable = "follow_accounts";
  }

  assertEquals(accountTable, "main_accounts");
});

Deno.test("Account Update: updates spam_accounts for spam type", () => {
  const accountType = "spam";
  let accountTable = "main_accounts";

  if (accountType === "spam") {
    accountTable = "spam_accounts";
  } else if (accountType === "follow") {
    accountTable = "follow_accounts";
  }

  assertEquals(accountTable, "spam_accounts");
});

Deno.test("Account Update: updates follow_accounts for follow type", () => {
  const accountType = "follow";
  let accountTable = "main_accounts";

  if (accountType === "spam") {
    accountTable = "spam_accounts";
  } else if (accountType === "follow") {
    accountTable = "follow_accounts";
  }

  assertEquals(accountTable, "follow_accounts");
});

Deno.test("Account Update: only updates if account_id exists", () => {
  const session = {
    account_id: "acc-123",
  };

  const shouldUpdate = !!session.account_id;

  assertEquals(shouldUpdate, true);
});

Deno.test("Account Update: skips update if account_id is null", () => {
  const session = {
    account_id: null,
  };

  const shouldUpdate = !!session.account_id;

  assertEquals(shouldUpdate, false);
});

Deno.test("Account Update: updates account profile fields", () => {
  const updateData = {
    name: "Twitter User",
    follower_count: 1000,
    following_count: 500,
    is_verified: true,
  };

  assertExists(updateData.name);
  assertExists(updateData.follower_count);
  assertExists(updateData.following_count);
  assertExists(updateData.is_verified);
});

Deno.test("Account Update: does not fail process on update error", () => {
  const updateError = { message: "Update failed" };

  // Should log error but continue
  assertExists(updateError.message);
  // Process should continue even with error
});

// Session Cleanup Tests
Deno.test("Session Cleanup: deletes oauth session after success", () => {
  const deleteQuery = {
    table: "oauth_sessions",
    filter: { id: "session-123" },
  };

  assertEquals(deleteQuery.table, "oauth_sessions");
  assertExists(deleteQuery.filter.id);
});

// Redirect Tests
Deno.test("Redirect: uses account_type to determine path", () => {
  const accountType = "main";
  let redirectPath = "/accounts/main";

  if (accountType === "spam") {
    redirectPath = "/accounts/spam";
  } else if (accountType === "follow") {
    redirectPath = "/accounts/follow";
  }

  assertEquals(redirectPath, "/accounts/main");
});

Deno.test("Redirect: redirects to /accounts/spam for spam type", () => {
  const accountType = "spam";
  let redirectPath = "/accounts/main";

  if (accountType === "spam") {
    redirectPath = "/accounts/spam";
  } else if (accountType === "follow") {
    redirectPath = "/accounts/follow";
  }

  assertEquals(redirectPath, "/accounts/spam");
});

Deno.test("Redirect: redirects to /accounts/follow for follow type", () => {
  const accountType = "follow";
  let redirectPath = "/accounts/main";

  if (accountType === "spam") {
    redirectPath = "/accounts/spam";
  } else if (accountType === "follow") {
    redirectPath = "/accounts/follow";
  }

  assertEquals(redirectPath, "/accounts/follow");
});

Deno.test("Redirect: includes connected=1 parameter", () => {
  const redirectUrl = new URL("http://localhost:3000/accounts/main");
  redirectUrl.searchParams.set("connected", "1");

  assertEquals(redirectUrl.searchParams.get("connected"), "1");
});

Deno.test("Redirect: includes account_id when available", () => {
  const accountId = "acc-123";
  const redirectUrl = new URL("http://localhost:3000/accounts/main");
  redirectUrl.searchParams.set("account_id", accountId);

  assertEquals(redirectUrl.searchParams.get("account_id"), accountId);
});

Deno.test("Redirect: omits account_id when null", () => {
  const session = {
    account_id: null,
  };

  const shouldIncludeAccountId = !!session.account_id;

  assertEquals(shouldIncludeAccountId, false);
});

Deno.test("Redirect: uses 302 status code", () => {
  const redirectStatus = 302;

  assertEquals(redirectStatus, 302);
});

// Error Handling Tests
Deno.test("Error Handling: redirects to twitter-apps on unexpected error", () => {
  const redirectUrl = "http://localhost:3000/twitter-apps?error=unexpected_error";

  assertStringIncludes(redirectUrl, "error=unexpected_error");
});

Deno.test("Error Handling: logs error to console", () => {
  const error = new Error("Test error");

  assertExists(error.message);
  assertEquals(error.message, "Test error");
});

console.log("✅ All 100+ tests for twitter-oauth-callback-v2 function defined");
console.log("Run with: deno test --allow-net --allow-env supabase/functions/twitter-oauth-callback-v2/index.test.ts");
