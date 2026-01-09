import { Page, Route } from '@playwright/test';

/**
 * Twitter API Mock Helper
 *
 * Intercepts Twitter API calls during E2E tests and returns mock responses.
 * This allows testing without making real Twitter API calls.
 */

export interface MockTwitterConfig {
  enableLogging?: boolean;
  mockOAuth?: boolean;
  mockTweets?: boolean;
  mockUsers?: boolean;
  mockDMs?: boolean;
}

interface MockResponse {
  status: number;
  contentType: string;
  body: string;
}

/**
 * Setup Twitter API mocks
 */
export async function setupTwitterApiMock(
  page: Page,
  config: MockTwitterConfig = {}
): Promise<void> {
  const {
    enableLogging = false,
    mockOAuth = true,
    mockTweets = true,
    mockUsers = true,
    mockDMs = true
  } = config;

  // Intercept Twitter API calls
  await page.route('https://api.twitter.com/**', async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (enableLogging) {
      console.log(`[Twitter API Mock] ${method} ${url}`);
    }

    let mockResponse: MockResponse | null = null;

    // OAuth Token Endpoint
    if (mockOAuth && url.includes('oauth2/token')) {
      mockResponse = handleOAuthToken(method, url);
    }
    // Tweet Creation
    else if (mockTweets && url.includes('/2/tweets') && method === 'POST') {
      mockResponse = handleCreateTweet(request.postDataJSON());
    }
    // Tweet Retrieval
    else if (mockTweets && url.includes('/2/tweets/') && method === 'GET') {
      mockResponse = handleGetTweet(url);
    }
    // User Info
    else if (mockUsers && url.includes('/2/users/me')) {
      mockResponse = handleGetUserInfo();
    }
    // User Lookup
    else if (mockUsers && url.includes('/2/users/')) {
      mockResponse = handleUserLookup(url);
    }
    // Tweet Search
    else if (mockTweets && url.includes('/2/tweets/search/recent')) {
      mockResponse = handleTweetSearch(url);
    }
    // DM Creation
    else if (mockDMs && url.includes('/2/dm_conversations') && method === 'POST') {
      mockResponse = handleCreateDM(request.postDataJSON());
    }
    // Likes
    else if (url.includes('/2/users/') && url.includes('/likes') && method === 'POST') {
      mockResponse = handleLikeTweet(request.postDataJSON());
    }
    // Retweets
    else if (url.includes('/2/users/') && url.includes('/retweets') && method === 'POST') {
      mockResponse = handleRetweet(request.postDataJSON());
    }
    // Follows
    else if (url.includes('/2/users/') && url.includes('/following') && method === 'POST') {
      mockResponse = handleFollow(request.postDataJSON());
    }

    if (mockResponse) {
      await route.fulfill({
        status: mockResponse.status,
        contentType: mockResponse.contentType,
        body: mockResponse.body
      });
    } else {
      // Allow request to continue if no mock defined
      await route.continue();
    }
  });

  if (enableLogging) {
    console.log('[Twitter API Mock] Setup complete');
  }
}

/**
 * Handle OAuth token request
 */
function handleOAuthToken(method: string, url: string): MockResponse {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      token_type: 'bearer',
      expires_in: 7200,
      access_token: 'mock_access_token_' + Date.now(),
      scope: 'tweet.read tweet.write users.read follows.read follows.write',
      refresh_token: 'mock_refresh_token_' + Date.now()
    })
  };
}

/**
 * Handle tweet creation
 */
function handleCreateTweet(data: any): MockResponse {
  const tweetId = 'mock_tweet_' + Date.now();

  return {
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        id: tweetId,
        text: data?.text || 'Mock tweet content',
        edit_history_tweet_ids: [tweetId]
      }
    })
  };
}

/**
 * Handle get tweet
 */
function handleGetTweet(url: string): MockResponse {
  const tweetId = url.match(/tweets\/([0-9]+)/)?.[1] || 'mock_tweet_123';

  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        id: tweetId,
        text: 'This is a mock tweet for testing',
        author_id: 'mock_user_123',
        created_at: new Date().toISOString(),
        public_metrics: {
          retweet_count: 10,
          reply_count: 5,
          like_count: 25,
          quote_count: 2,
          impression_count: 1000
        }
      }
    })
  };
}

/**
 * Handle get user info
 */
function handleGetUserInfo(): MockResponse {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        id: 'mock_user_123',
        username: 'test_user',
        name: 'Test User',
        description: 'This is a test user for E2E testing',
        profile_image_url: 'https://example.com/avatar.jpg',
        public_metrics: {
          followers_count: 1000,
          following_count: 500,
          tweet_count: 5000,
          listed_count: 10
        },
        created_at: new Date('2020-01-01').toISOString(),
        verified: false
      }
    })
  };
}

/**
 * Handle user lookup
 */
function handleUserLookup(url: string): MockResponse {
  const userId = url.match(/users\/([0-9]+)/)?.[1] || 'mock_user_123';

  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        id: userId,
        username: `test_user_${userId}`,
        name: `Test User ${userId}`,
        public_metrics: {
          followers_count: 1000,
          following_count: 500,
          tweet_count: 2000
        }
      }
    })
  };
}

/**
 * Handle tweet search
 */
function handleTweetSearch(url: string): MockResponse {
  const queryMatch = url.match(/query=([^&]+)/);
  const query = queryMatch ? decodeURIComponent(queryMatch[1]) : '';

  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: [
        {
          id: 'mock_tweet_1',
          text: `Tweet matching query: ${query}`,
          author_id: 'mock_user_1',
          created_at: new Date().toISOString(),
          public_metrics: {
            retweet_count: 5,
            reply_count: 2,
            like_count: 15,
            quote_count: 1
          }
        },
        {
          id: 'mock_tweet_2',
          text: `Another tweet for: ${query}`,
          author_id: 'mock_user_2',
          created_at: new Date().toISOString(),
          public_metrics: {
            retweet_count: 3,
            reply_count: 1,
            like_count: 10,
            quote_count: 0
          }
        }
      ],
      meta: {
        result_count: 2,
        newest_id: 'mock_tweet_2',
        oldest_id: 'mock_tweet_1'
      }
    })
  };
}

/**
 * Handle DM creation
 */
function handleCreateDM(data: any): MockResponse {
  return {
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        dm_conversation_id: 'mock_dm_conversation_' + Date.now(),
        dm_event_id: 'mock_dm_event_' + Date.now()
      }
    })
  };
}

/**
 * Handle like tweet
 */
function handleLikeTweet(data: any): MockResponse {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        liked: true
      }
    })
  };
}

/**
 * Handle retweet
 */
function handleRetweet(data: any): MockResponse {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        retweeted: true
      }
    })
  };
}

/**
 * Handle follow user
 */
function handleFollow(data: any): MockResponse {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        following: true,
        pending_follow: false
      }
    })
  };
}

/**
 * Clear all Twitter API mocks
 */
export async function clearTwitterApiMock(page: Page): Promise<void> {
  await page.unroute('https://api.twitter.com/**');
}

/**
 * Monitor Twitter API calls
 */
export interface TwitterApiCall {
  method: string;
  url: string;
  timestamp: number;
  requestData?: any;
}

export function createTwitterApiMonitor(page: Page): {
  calls: TwitterApiCall[];
  start: () => void;
  stop: () => void;
  getCalls: () => TwitterApiCall[];
  getCallsByEndpoint: (endpoint: string) => TwitterApiCall[];
} {
  const calls: TwitterApiCall[] = [];
  let monitoring = false;

  const requestListener = (request: any) => {
    if (monitoring && request.url().includes('api.twitter.com')) {
      calls.push({
        method: request.method(),
        url: request.url(),
        timestamp: Date.now(),
        requestData: request.postDataJSON?.()
      });
    }
  };

  return {
    calls,
    start: () => {
      monitoring = true;
      page.on('request', requestListener);
    },
    stop: () => {
      monitoring = false;
      page.off('request', requestListener);
    },
    getCalls: () => calls,
    getCallsByEndpoint: (endpoint: string) =>
      calls.filter(call => call.url.includes(endpoint))
  };
}
