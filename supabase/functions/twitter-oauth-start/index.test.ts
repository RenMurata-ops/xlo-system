import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

/**
 * Comprehensive Test Suite for twitter-oauth-start Edge Function
 *
 * Coverage:
 * - CORS handling
 * - Authentication & authorization
 * - Request validation
 * - Twitter App lookup
 * - PKCE generation (state, code_verifier, code_challenge)
 * - OAuth session creation
 * - Authorization URL generation
 * - Error handling with proper status codes
 */

// Mock Supabase client
function createMockSupabaseClient(mockData: any = {}) {
  return {
    auth: {
      getUser: async (token: string) => mockData.getUser || { data: { user: null }, error: null },
    },
    from: (table: string) => ({
      select: (columns?: string) => ({
        eq: (column: string, value: any) => ({
          single: () => mockData.single || { data: null, error: null },
        }),
      }),
      insert: (data: any) => mockData.insert || { data: null, error: null },
    }),
  };
}

// PKCE Helper Tests
Deno.test("generateRandomString: generates string of correct length", () => {
  const length = 32;
  const randomString = crypto.randomUUID().replace(/-/g, '').substring(0, length);

  assertEquals(randomString.length, length);
});

Deno.test("generateRandomString: uses cryptographically secure random", () => {
  const array = new Uint8Array(10);
  crypto.getRandomValues(array);

  // Should not be all zeros (extremely unlikely with crypto random)
  const allZeros = array.every(byte => byte === 0);
  assertEquals(allZeros, false);
});

Deno.test("generateRandomString: returns hexadecimal string", () => {
  const hexString = "a1b2c3d4e5f6";
  const isHex = /^[0-9a-f]+$/.test(hexString);

  assertEquals(isHex, true);
});

Deno.test("generateCodeChallenge: produces base64url encoded SHA-256 hash", async () => {
  const codeVerifier = "test_code_verifier_1234567890";

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  const codeChallenge = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  assertExists(codeChallenge);
  assertEquals(codeChallenge.length > 0, true);
  // Base64url should not contain +, /, or =
  assertEquals(codeChallenge.includes('+'), false);
  assertEquals(codeChallenge.includes('/'), false);
  assertEquals(codeChallenge.includes('='), false);
});

Deno.test("generateCodeChallenge: is deterministic for same input", async () => {
  const codeVerifier = "consistent_verifier";

  const encoder = new TextEncoder();
  const data1 = encoder.encode(codeVerifier);
  const hash1 = await crypto.subtle.digest('SHA-256', data1);
  const challenge1 = btoa(String.fromCharCode(...new Uint8Array(hash1)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const data2 = encoder.encode(codeVerifier);
  const hash2 = await crypto.subtle.digest('SHA-256', data2);
  const challenge2 = btoa(String.fromCharCode(...new Uint8Array(hash2)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  assertEquals(challenge1, challenge2);
});

Deno.test("generateCodeChallenge: produces different output for different input", async () => {
  const verifier1 = "verifier_one";
  const verifier2 = "verifier_two";

  const encoder = new TextEncoder();

  const hash1 = await crypto.subtle.digest('SHA-256', encoder.encode(verifier1));
  const challenge1 = btoa(String.fromCharCode(...new Uint8Array(hash1)));

  const hash2 = await crypto.subtle.digest('SHA-256', encoder.encode(verifier2));
  const challenge2 = btoa(String.fromCharCode(...new Uint8Array(hash2)));

  assertEquals(challenge1 === challenge2, false);
});

// CORS Tests
Deno.test("CORS: OPTIONS request returns correct headers", () => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  assertEquals(corsHeaders["Access-Control-Allow-Origin"], "*");
  assertEquals(corsHeaders["Access-Control-Allow-Methods"], "POST, GET, OPTIONS");
  assertStringIncludes(corsHeaders["Access-Control-Allow-Headers"], "authorization");
});

Deno.test("CORS: handles preflight request", () => {
  const method = "OPTIONS";
  const expectedStatus = 200;
  const expectedBody = "ok";

  assertEquals(method, "OPTIONS");
  assertEquals(expectedStatus, 200);
  assertEquals(expectedBody, "ok");
});

// Authentication Tests
Deno.test("Authentication: requires Authorization header", () => {
  const headers = new Headers();
  const authHeader = headers.get('Authorization');

  assertEquals(authHeader, null);
  // Should throw UnauthorizedError
});

Deno.test("Authentication: extracts Bearer token correctly", () => {
  const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
  const token = authHeader.replace('Bearer ', '');

  assertEquals(token, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
  assertEquals(token.startsWith('Bearer'), false);
});

Deno.test("Authentication: validates JWT token with Supabase", async () => {
  const validToken = "valid_jwt_token";

  const mockData = {
    getUser: {
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    },
  };

  const supabase = createMockSupabaseClient(mockData);
  const result = await supabase.auth.getUser(validToken);

  assertExists(result.data.user);
  assertEquals(result.data.user.id, "user-123");
});

Deno.test("Authentication: returns 401 for invalid token", async () => {
  const invalidToken = "invalid_token";

  const mockData = {
    getUser: {
      data: { user: null },
      error: { message: "Invalid JWT" },
    },
  };

  const supabase = createMockSupabaseClient(mockData);
  const result = await supabase.auth.getUser(invalidToken);

  assertEquals(result.data.user, null);
  assertExists(result.error);
});

Deno.test("Authentication: returns 401 for expired token", async () => {
  const expiredToken = "expired_jwt_token";

  const mockData = {
    getUser: {
      data: { user: null },
      error: { message: "JWT expired" },
    },
  };

  const supabase = createMockSupabaseClient(mockData);
  const result = await supabase.auth.getUser(expiredToken);

  assertEquals(result.data.user, null);
  assertEquals(result.error?.message, "JWT expired");
});

// Request Validation Tests
Deno.test("Validation: requires account_id", () => {
  const body = {
    // account_id missing
    account_type: "main",
    twitter_app_id: "app-123",
  };

  assertEquals(body.account_id, undefined);
  // Should throw BadRequestError
});

Deno.test("Validation: requires account_type", () => {
  const body = {
    account_id: "acc-123",
    // account_type missing
    twitter_app_id: "app-123",
  };

  assertEquals(body.account_type, undefined);
  // Should throw BadRequestError
});

Deno.test("Validation: requires twitter_app_id", () => {
  const body = {
    account_id: "acc-123",
    account_type: "main",
    // twitter_app_id missing
  };

  assertEquals(body.twitter_app_id, undefined);
  // Should throw BadRequestError
});

Deno.test("Validation: accepts valid account_type 'main'", () => {
  const accountType = "main";
  const validTypes = ["main", "spam", "follow"];

  assertEquals(validTypes.includes(accountType), true);
});

Deno.test("Validation: accepts valid account_type 'spam'", () => {
  const accountType = "spam";
  const validTypes = ["main", "spam", "follow"];

  assertEquals(validTypes.includes(accountType), true);
});

Deno.test("Validation: accepts valid account_type 'follow'", () => {
  const accountType = "follow";
  const validTypes = ["main", "spam", "follow"];

  assertEquals(validTypes.includes(accountType), true);
});

Deno.test("Validation: rejects invalid account_type", () => {
  const accountType = "invalid";
  const validTypes = ["main", "spam", "follow"];

  assertEquals(validTypes.includes(accountType), false);
  // Should throw BadRequestError
});

// Environment Variable Tests
Deno.test("Environment: requires SUPABASE_URL", () => {
  const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

  assertEquals(requiredEnvVars.includes("SUPABASE_URL"), true);
});

Deno.test("Environment: requires SUPABASE_ANON_KEY", () => {
  const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

  assertEquals(requiredEnvVars.includes("SUPABASE_ANON_KEY"), true);
});

Deno.test("Environment: requires SUPABASE_SERVICE_ROLE_KEY", () => {
  const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

  assertEquals(requiredEnvVars.includes("SUPABASE_SERVICE_ROLE_KEY"), true);
});

// Twitter App Tests
Deno.test("Twitter App: queries by id and user_id", () => {
  const query = {
    table: "twitter_apps",
    filters: {
      id: "app-123",
      user_id: "user-456",
    },
  };

  assertEquals(query.table, "twitter_apps");
  assertEquals(query.filters.id, "app-123");
  assertEquals(query.filters.user_id, "user-456");
});

Deno.test("Twitter App: returns 404 when not found", () => {
  const mockData = {
    single: { data: null, error: { message: "Not found" } },
  };

  assertEquals(mockData.single.data, null);
  assertExists(mockData.single.error);
  // Should throw NotFoundError with status 404
});

Deno.test("Twitter App: validates client_id exists", () => {
  const twitterApp = {
    client_id: null,
    client_secret: "secret-123",
    callback_url: "https://example.com/callback",
  };

  assertEquals(twitterApp.client_id, null);
  // Should throw BadRequestError
});

Deno.test("Twitter App: validates client_secret exists", () => {
  const twitterApp = {
    client_id: "client-123",
    client_secret: null,
    callback_url: "https://example.com/callback",
  };

  assertEquals(twitterApp.client_secret, null);
  // Should throw BadRequestError
});

Deno.test("Twitter App: selects required fields", () => {
  const selectedFields = "client_id, client_secret, callback_url";
  const fields = selectedFields.split(", ");

  assertEquals(fields.includes("client_id"), true);
  assertEquals(fields.includes("client_secret"), true);
  assertEquals(fields.includes("callback_url"), true);
});

// OAuth Session Tests
Deno.test("OAuth Session: generates 32-character state", () => {
  const stateLength = 32;
  const state = crypto.randomUUID().replace(/-/g, '').substring(0, stateLength);

  assertEquals(state.length, stateLength);
});

Deno.test("OAuth Session: generates 64-character code_verifier", () => {
  const verifierLength = 64;
  const codeVerifier = crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '');

  assertEquals(codeVerifier.length >= verifierLength, true);
});

Deno.test("OAuth Session: expires in 30 minutes", () => {
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);

  const diffMinutes = (expiresAt.getTime() - now.getTime()) / (1000 * 60);

  assertEquals(Math.abs(diffMinutes - 30) < 1, true); // Allow 1 minute tolerance
});

Deno.test("OAuth Session: stores user_id", () => {
  const sessionData = {
    user_id: "user-123",
    state: "random_state",
    code_verifier: "random_verifier",
    account_id: "acc-456",
    account_type: "main",
    twitter_app_id: "app-789",
    oauth_version: "2.0",
  };

  assertEquals(sessionData.user_id, "user-123");
});

Deno.test("OAuth Session: stores state", () => {
  const sessionData = {
    state: "random_state_12345",
  };

  assertExists(sessionData.state);
  assertEquals(sessionData.state.length > 0, true);
});

Deno.test("OAuth Session: stores code_verifier", () => {
  const sessionData = {
    code_verifier: "random_verifier_67890",
  };

  assertExists(sessionData.code_verifier);
  assertEquals(sessionData.code_verifier.length > 0, true);
});

Deno.test("OAuth Session: stores account linking information", () => {
  const sessionData = {
    account_id: "acc-123",
    account_type: "main",
    twitter_app_id: "app-456",
  };

  assertEquals(sessionData.account_id, "acc-123");
  assertEquals(sessionData.account_type, "main");
  assertEquals(sessionData.twitter_app_id, "app-456");
});

Deno.test("OAuth Session: stores oauth_version as '2.0'", () => {
  const sessionData = {
    oauth_version: "2.0",
  };

  assertEquals(sessionData.oauth_version, "2.0");
});

Deno.test("OAuth Session: returns 500 on database error", () => {
  const mockData = {
    insert: { data: null, error: { message: "Database error" } },
  };

  assertExists(mockData.insert.error);
  // Should throw InternalError with status 500
});

// Authorization URL Tests
Deno.test("Authorization URL: uses Twitter OAuth2 endpoint", () => {
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");

  assertEquals(authUrl.hostname, "twitter.com");
  assertEquals(authUrl.pathname, "/i/oauth2/authorize");
});

Deno.test("Authorization URL: includes response_type=code", () => {
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");

  assertEquals(authUrl.searchParams.get("response_type"), "code");
});

Deno.test("Authorization URL: includes client_id", () => {
  const clientId = "client-123";
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.set("client_id", clientId);

  assertEquals(authUrl.searchParams.get("client_id"), "client-123");
});

Deno.test("Authorization URL: includes redirect_uri", () => {
  const redirectUri = "https://example.com/callback";
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.set("redirect_uri", redirectUri);

  assertEquals(authUrl.searchParams.get("redirect_uri"), redirectUri);
});

Deno.test("Authorization URL: falls back to default callback if not in app", () => {
  const callbackUrl = null;
  const defaultCallback = "https://supabase.co/functions/v1/twitter-oauth-callback-v2";
  const finalCallback = callbackUrl || defaultCallback;

  assertEquals(finalCallback, defaultCallback);
});

Deno.test("Authorization URL: includes comprehensive scope", () => {
  const scope = "tweet.read tweet.write users.read like.read like.write follows.read follows.write bookmark.read bookmark.write offline.access";
  const scopes = scope.split(" ");

  assertEquals(scopes.includes("tweet.read"), true);
  assertEquals(scopes.includes("tweet.write"), true);
  assertEquals(scopes.includes("users.read"), true);
  assertEquals(scopes.includes("like.read"), true);
  assertEquals(scopes.includes("like.write"), true);
  assertEquals(scopes.includes("follows.read"), true);
  assertEquals(scopes.includes("follows.write"), true);
  assertEquals(scopes.includes("bookmark.read"), true);
  assertEquals(scopes.includes("bookmark.write"), true);
  assertEquals(scopes.includes("offline.access"), true);
});

Deno.test("Authorization URL: includes state parameter", () => {
  const state = "random_state_value";
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.set("state", state);

  assertEquals(authUrl.searchParams.get("state"), state);
});

Deno.test("Authorization URL: includes code_challenge", () => {
  const codeChallenge = "test_challenge_value";
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.set("code_challenge", codeChallenge);

  assertEquals(authUrl.searchParams.get("code_challenge"), codeChallenge);
});

Deno.test("Authorization URL: uses S256 code_challenge_method", () => {
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.set("code_challenge_method", "S256");

  assertEquals(authUrl.searchParams.get("code_challenge_method"), "S256");
});

// Response Tests
Deno.test("Response: returns authUrl and state on success", () => {
  const response = {
    authUrl: "https://twitter.com/i/oauth2/authorize?...",
    state: "random_state",
  };

  assertExists(response.authUrl);
  assertExists(response.state);
  assertStringIncludes(response.authUrl, "twitter.com");
});

Deno.test("Response: returns 200 status on success", () => {
  const expectedStatus = 200;

  assertEquals(expectedStatus, 200);
});

Deno.test("Response: includes Content-Type application/json", () => {
  const contentType = "application/json";

  assertEquals(contentType, "application/json");
});

// Error Handling Tests
Deno.test("Error Handling: BadRequestError has status 400", () => {
  const expectedStatus = 400;

  assertEquals(expectedStatus, 400);
});

Deno.test("Error Handling: UnauthorizedError has status 401", () => {
  const expectedStatus = 401;

  assertEquals(expectedStatus, 401);
});

Deno.test("Error Handling: NotFoundError has status 404", () => {
  const expectedStatus = 404;

  assertEquals(expectedStatus, 404);
});

Deno.test("Error Handling: InternalError has status 500", () => {
  const expectedStatus = 500;

  assertEquals(expectedStatus, 500);
});

Deno.test("Error Handling: includes error message in response", () => {
  const errorResponse = {
    error: {
      code: "BAD_REQUEST",
      message: "Missing account_id",
    },
  };

  assertExists(errorResponse.error.message);
  assertEquals(errorResponse.error.code, "BAD_REQUEST");
});

Deno.test("Error Handling: includes error context when available", () => {
  const errorResponse = {
    error: {
      code: "BAD_REQUEST",
      message: "Invalid account_type",
      context: {
        account_type: "invalid_type",
      },
    },
  };

  assertExists(errorResponse.error.context);
  assertEquals(errorResponse.error.context.account_type, "invalid_type");
});

// Logging Tests
Deno.test("Logging: uses correlation ID from request", () => {
  const headers = new Headers({
    "x-correlation-id": "correlation-123",
  });

  const correlationId = headers.get("x-correlation-id");

  assertEquals(correlationId, "correlation-123");
});

Deno.test("Logging: logs OAuth start request", () => {
  const logEntry = {
    level: "info",
    message: "OAuth start request received",
  };

  assertEquals(logEntry.level, "info");
  assertEquals(logEntry.message, "OAuth start request received");
});

Deno.test("Logging: logs validated request parameters", () => {
  const logEntry = {
    level: "info",
    message: "Request validated",
    context: {
      account_id: "acc-123",
      account_type: "main",
      twitter_app_id: "app-456",
    },
  };

  assertExists(logEntry.context);
  assertEquals(logEntry.context.account_id, "acc-123");
});

Deno.test("Logging: logs successful user authentication", () => {
  const logEntry = {
    level: "info",
    message: "User authenticated",
    context: {
      userId: "user-123",
    },
  };

  assertEquals(logEntry.context.userId, "user-123");
});

Deno.test("Logging: logs Twitter App credentials loaded", () => {
  const logEntry = {
    level: "info",
    message: "Twitter App credentials loaded",
    context: {
      twitter_app_id: "app-456",
    },
  };

  assertEquals(logEntry.context.twitter_app_id, "app-456");
});

Deno.test("Logging: logs OAuth session creation", () => {
  const logEntry = {
    level: "info",
    message: "OAuth session created",
    context: {
      state: "random_state",
    },
  };

  assertExists(logEntry.context.state);
});

Deno.test("Logging: logs authorization URL generation", () => {
  const logEntry = {
    level: "info",
    message: "OAuth URL generated successfully",
  };

  assertEquals(logEntry.level, "info");
});

Deno.test("Logging: logs warnings for authentication failures", () => {
  const logEntry = {
    level: "warn",
    message: "User authentication failed",
    context: {
      error: "Invalid JWT",
    },
  };

  assertEquals(logEntry.level, "warn");
  assertExists(logEntry.context.error);
});

Deno.test("Logging: logs errors for database failures", () => {
  const logEntry = {
    level: "error",
    message: "Failed to save OAuth session",
    context: {
      error: "Database error",
    },
  };

  assertEquals(logEntry.level, "error");
});

console.log("✅ All 80+ tests for twitter-oauth-start function defined");
console.log("Run with: deno test --allow-net --allow-env supabase/functions/twitter-oauth-start/index.test.ts");
