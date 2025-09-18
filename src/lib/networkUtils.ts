// Network utility functions for handling connection issues

export const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch('/favicon.ico', { 
      method: 'HEAD',
      cache: 'no-cache'
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Check if it's a network error
      const isNetworkError = lastError.message.includes('Failed to fetch') || 
                           lastError.message.includes('NetworkError') ||
                           lastError.message.includes('ERR_NETWORK');
      
      if (!isNetworkError) {
        throw lastError;
      }
      
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
  
  throw lastError!;
};

export const withNetworkErrorHandling = async <T>(
  operation: () => Promise<T>,
  errorMessage: string = 'Network operation failed'
): Promise<T> => {
  try {
    const isOnline = await checkNetworkConnection();
    if (!isOnline) {
      throw new Error('No internet connection detected');
    }
    
    return await retryOperation(operation);
  } catch (error) {
    const networkError = error as Error;
    throw new Error(`${errorMessage}: ${networkError.message}`);
  }
};