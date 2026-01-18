export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, maxRetries: number, error: Error) => void;
}

/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetriesOrOptions: number | RetryOptions = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  // Handle both old signature (numbers) and new signature (options object)
  const options: RetryOptions = typeof maxRetriesOrOptions === 'number' 
    ? { maxRetries: maxRetriesOrOptions, baseDelay, maxDelay }
    : maxRetriesOrOptions;
  
  const {
    maxRetries = 3,
    baseDelay: delay = 1000,
    maxDelay: cap = 10000,
    onRetry
  } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a network error that should be retried
      const isRetryable = 
        lastError.message.includes('Network') ||
        lastError.message.includes('500') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('connection');
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }
      
      // Notify about retry attempt
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, lastError);
      }
      
      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = delay * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialDelay;
      const actualDelay = Math.min(exponentialDelay + jitter, cap);
      
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(actualDelay)}ms`);
      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
  }
  
  throw lastError;
}
