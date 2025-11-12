import { createClient } from '@/lib/supabase/client';

interface TwitterApiRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, any>;
  body?: any;
  x_user_id?: string;
  account_id?: string;
}

interface TwitterApiResponse {
  success: boolean;
  status: number;
  data: any;
  rateLimits?: {
    limit: string | null;
    remaining: string | null;
    reset: string | null;
  };
  error?: string;
}

export async function callTwitterApi(
  request: TwitterApiRequest
): Promise<TwitterApiResponse> {
  const supabase = createClient();

  // Get current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Unauthorized: No active session');
  }

  // Call twitter-api-proxy Edge Function
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/twitter-api-proxy`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );

  const result = await response.json();
  return result;
}

// Helper function to post a tweet
export async function postTweet(
  text: string,
  options?: {
    x_user_id?: string;
    account_id?: string;
  }
): Promise<TwitterApiResponse> {
  return callTwitterApi({
    endpoint: '/2/tweets',
    method: 'POST',
    body: {
      text,
    },
    ...options,
  });
}

// Helper function to get user info
export async function getUserInfo(
  options?: {
    x_user_id?: string;
    account_id?: string;
  }
): Promise<TwitterApiResponse> {
  return callTwitterApi({
    endpoint: '/2/users/me',
    method: 'GET',
    ...options,
  });
}

// Helper function to like a tweet
export async function likeTweet(
  tweetId: string,
  options?: {
    x_user_id?: string;
    account_id?: string;
  }
): Promise<TwitterApiResponse> {
  return callTwitterApi({
    endpoint: `/2/users/me/likes`,
    method: 'POST',
    body: {
      tweet_id: tweetId,
    },
    ...options,
  });
}

// Helper function to retweet
export async function retweet(
  tweetId: string,
  options?: {
    x_user_id?: string;
    account_id?: string;
  }
): Promise<TwitterApiResponse> {
  return callTwitterApi({
    endpoint: `/2/users/me/retweets`,
    method: 'POST',
    body: {
      tweet_id: tweetId,
    },
    ...options,
  });
}

// Helper function to follow a user
export async function followUser(
  targetUserId: string,
  options?: {
    x_user_id?: string;
    account_id?: string;
  }
): Promise<TwitterApiResponse> {
  return callTwitterApi({
    endpoint: `/2/users/me/following`,
    method: 'POST',
    body: {
      target_user_id: targetUserId,
    },
    ...options,
  });
}
