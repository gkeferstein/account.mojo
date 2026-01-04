import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

// Mock API
vi.mock('@/lib/api', () => ({
  accountsApi: {
    getSubscription: vi.fn(),
    getEntitlements: vi.fn(),
  },
}));

import { accountsApi } from '@/lib/api';

describe('React Query Integration', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    vi.clearAllMocks();
  });

  it('should cache subscription data', async () => {
    const mockSubscription = {
      subscription: {
        id: 'sub_123',
        status: 'active',
        planId: 'plan_123',
        planName: 'Pro',
      },
    };

    (accountsApi.getSubscription as any).mockResolvedValue(mockSubscription);

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['subscription', 'tenant_123'],
          queryFn: async () => {
            const token = 'mock-token';
            return accountsApi.getSubscription(token);
          },
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSubscription);
    expect(accountsApi.getSubscription).toHaveBeenCalledTimes(1);
  });

  it('should deduplicate concurrent requests', async () => {
    const mockEntitlements = {
      entitlements: [],
      total: 0,
    };

    (accountsApi.getEntitlements as any).mockResolvedValue(mockEntitlements);

    const { result: result1 } = renderHook(
      () =>
        useQuery({
          queryKey: ['entitlements', 'tenant_123'],
          queryFn: async () => {
            const token = 'mock-token';
            return accountsApi.getEntitlements(token);
          },
        }),
      { wrapper }
    );

    const { result: result2 } = renderHook(
      () =>
        useQuery({
          queryKey: ['entitlements', 'tenant_123'],
          queryFn: async () => {
            const token = 'mock-token';
            return accountsApi.getEntitlements(token);
          },
        }),
      { wrapper }
    );

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));

    // Should only call API once due to request deduplication
    expect(accountsApi.getEntitlements).toHaveBeenCalledTimes(1);
  });

  it('should respect staleTime configuration', async () => {
    const mockSubscription = {
      subscription: null,
    };

    (accountsApi.getSubscription as any).mockResolvedValue(mockSubscription);

    const { result, rerender } = renderHook(
      () =>
        useQuery({
          queryKey: ['subscription', 'tenant_123'],
          queryFn: async () => {
            const token = 'mock-token';
            return accountsApi.getSubscription(token);
          },
          staleTime: 5 * 60 * 1000, // 5 minutes
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Rerender should not trigger new request if data is still fresh
    rerender();

    // Should still be called only once
    expect(accountsApi.getSubscription).toHaveBeenCalledTimes(1);
  });
});

