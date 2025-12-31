/**
 * Base HTTP Client with Retry, Timeout, and Error Handling
 * 
 * Provides resilient HTTP requests with:
 * - Exponential backoff retry for transient errors
 * - Request timeouts
 * - Consistent error handling
 */

export interface HttpClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number; // Default: 10000ms
  maxRetries?: number; // Default: 3
  retryDelay?: number; // Initial delay in ms, default: 1000
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryableStatusCodes?: number[];
}

/**
 * Check if an error is a network error (retryable)
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors like ECONNREFUSED, ETIMEDOUT, etc.
    return error.name === 'TypeError' || 
           error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('timeout');
  }
  return false;
}

/**
 * Check if HTTP status code indicates a retryable error
 */
function isRetryableStatusCode(statusCode: number, retryableCodes: number[]): boolean {
  // 5xx errors are always retryable (server errors)
  if (statusCode >= 500) return true;
  
  // 429 Too Many Requests is retryable
  if (statusCode === 429) return true;
  
  // Custom retryable codes
  return retryableCodes.includes(statusCode);
}

/**
 * Delay helper for retries (exponential backoff)
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Base HTTP Client with retry and timeout logic
 */
export class BaseHttpClient {
  protected config: Required<Pick<HttpClientConfig, 'baseUrl' | 'apiKey' | 'timeout' | 'maxRetries'>> & {
    retryDelay: number;
  };

  constructor(config: HttpClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 10000, // 10 seconds default
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000, // 1 second initial delay
    };
  }

  /**
   * Fetch with retry logic and timeout
   */
  protected async fetchWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOptions?: RetryOptions
  ): Promise<T> {
    const {
      maxRetries = this.config.maxRetries,
      retryDelay = this.config.retryDelay,
      retryableStatusCodes = [],
    } = retryOptions ?? {};

    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchWithTimeout(
          url,
          {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.apiKey}`,
              ...((options.headers as Record<string, string>) ?? {}),
            },
          },
          this.config.timeout
        );

        // Check if response is retryable
        if (!response.ok && attempt < maxRetries) {
          if (isRetryableStatusCode(response.status, retryableStatusCodes)) {
            // Calculate exponential backoff: delay * 2^attempt
            const backoffMs = retryDelay * Math.pow(2, attempt);
            
            // Get error message for logging
            const errorData = await response.json().catch(() => ({ 
              message: `HTTP ${response.status}` 
            })) as { message?: string; error?: { message?: string } };
            lastError = new Error(errorData.message || errorData.error?.message || `HTTP ${response.status}`);
            
            // Wait before retry (except on last attempt)
            await delay(backoffMs);
            continue;
          }
        }

        // Success or non-retryable error
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string; error?: { message?: string } };
          throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
        }

        return await response.json() as T;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Network errors are retryable
        if (isNetworkError(error) && attempt < maxRetries) {
          // Calculate exponential backoff
          const backoffMs = retryDelay * Math.pow(2, attempt);
          await delay(backoffMs);
          continue;
        }

        // Non-retryable error or max retries reached
        throw lastError;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Request failed after retries');
  }
}

