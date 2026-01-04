'use client';

/**
 * Custom hook to get Clerk token
 * Simplifies token retrieval and error handling across components
 */

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

export function useToken() {
  const { getToken } = useAuth();

  const getTokenOrThrow = useCallback(async (): Promise<string> => {
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return token;
  }, [getToken]);

  return {
    getToken: getTokenOrThrow,
    getTokenOptional: getToken,
  };
}

