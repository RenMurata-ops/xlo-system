/**
 * Fetch with timeout and retry logic
 * Prevents hanging requests and implements exponential backoff
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number; // milliseconds
  maxRetries?: number;
  retryableStatuses?: number[]; // HTTP status codes that should trigger retry
}

export async function fetchWithTimeout(
  url: string | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = 30000, // 30 seconds default
    maxRetries = 3,
    retryableStatuses = [408, 429, 500, 502, 503, 504],
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if response status is retryable
      if (!response.ok && retryableStatuses.includes(response.status)) {
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`Retrying after ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        lastError = new Error(`Request timeout after ${timeout}ms`);
      } else {
        lastError = error;
      }

      // Retry on network errors
      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`Network error, retrying after ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after all retries');
}

/**
 * Validate required environment variables
 * Throws error if any required variable is missing
 */
export function validateEnv(vars: string[]): void {
  const missing = vars.filter(varName => !Deno.env.get(varName));

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Get environment variable with validation
 */
export function getRequiredEnv(varName: string): string {
  const value = Deno.env.get(varName);

  if (!value) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }

  return value;
}
