/**
 * Cache Service
 * Centralizes cache management logic to reduce duplication
 * Implements Single-Flight Pattern to prevent cache refresh race conditions
 */

import { CACHE_TTL } from '../lib/constants.js';
import prisma from '../lib/prisma.js';
import type { Profile } from '@accounts/shared';
import type { Subscription, Invoice, Entitlement } from '@accounts/shared';

/**
 * Single-Flight Pattern: Track ongoing refresh operations
 * Prevents multiple concurrent requests from triggering the same cache refresh
 */
const refreshPromises = new Map<string, Promise<unknown>>();

/**
 * Execute a cache refresh operation with Single-Flight Pattern
 * If a refresh is already in progress for the same key, returns the existing promise
 * Otherwise, starts a new refresh operation
 */
export async function withSingleFlight<T>(
  key: string,
  refreshFn: () => Promise<T>
): Promise<T> {
  // Check if refresh is already in progress
  const existingPromise = refreshPromises.get(key);
  if (existingPromise) {
    // Wait for existing refresh to complete
    return existingPromise as Promise<T>;
  }

  // Start new refresh operation
  const promise = (async () => {
    try {
      return await refreshFn();
    } finally {
      // Remove from map when done (success or failure)
      refreshPromises.delete(key);
    }
  })();

  refreshPromises.set(key, promise);
  return promise;
}

/**
 * Check if cache is stale based on TTL
 */
export function isCacheStale<T extends { updatedAt: Date }>(
  cache: T | null,
  ttlMs: number
): boolean {
  if (!cache) return true;
  const cacheAge = Date.now() - cache.updatedAt.getTime();
  return cacheAge > ttlMs;
}

/**
 * Update or create cache entry
 * @deprecated This generic function is not type-safe. Use specific update functions instead.
 */
export async function updateCache<T>(
  model: {
    upsert: (args: {
      where: { tenantId: string; userId: string };
      create: { tenantId: string; userId: string; payload: T };
      update: { payload: T };
    }) => Promise<unknown>;
  },
  where: { tenantId: string; userId: string },
  data: T
) {
  return model.upsert({
    where,
    create: {
      ...where,
      payload: data,
    },
    update: {
      payload: data,
    },
  });
}

/**
 * Generic cache refresh helper with Single-Flight Pattern
 * Handles the common pattern: check cache -> refresh if stale -> fallback on error
 */
export async function refreshCacheWithFallback<T>(
  cacheKey: string,
  currentCache: T | null,
  isStale: boolean,
  refreshFn: () => Promise<T>,
  createEmptyCacheFn?: () => Promise<T>,
  onError?: (error: unknown, hasStaleCache: boolean) => void
): Promise<T | null> {
  if (!isStale && currentCache) {
    return currentCache;
  }

  try {
    return await withSingleFlight(cacheKey, refreshFn);
  } catch (error) {
    if (onError) {
      onError(error, !!currentCache);
    }

    // Fallback to stale cache if available
    if (currentCache) {
      return currentCache;
    }

    // Create empty cache if factory provided
    if (createEmptyCacheFn) {
      return await createEmptyCacheFn();
    }

    return null;
  }
}

/**
 * Update ProfileCache
 */
export async function updateProfileCache(
  tenantId: string,
  userId: string,
  profile: Profile
) {
  return prisma.profileCache.upsert({
    where: {
      tenantId_userId: {
        tenantId,
        userId,
      },
    },
    create: {
      tenantId,
      userId,
      payload: profile,
    },
    update: {
      payload: profile,
    },
  });
}

/**
 * Update BillingCache
 */
export async function updateBillingCache(
  tenantId: string,
  userId: string,
  data: {
    subscription?: Subscription | null;
    invoices?: Invoice[] | null;
  }
) {
  return prisma.billingCache.upsert({
    where: {
      tenantId_userId: {
        tenantId,
        userId,
      },
    },
    create: {
      tenantId,
      userId,
      subscription: data.subscription || null,
      invoices: data.invoices || null,
    },
    update: {
      ...(data.subscription !== undefined && { subscription: data.subscription }),
      ...(data.invoices !== undefined && { invoices: data.invoices }),
    },
  });
}

/**
 * Update EntitlementCache
 */
export async function updateEntitlementCache(
  tenantId: string,
  userId: string,
  entitlements: Entitlement[]
) {
  return prisma.entitlementCache.upsert({
    where: {
      tenantId_userId: {
        tenantId,
        userId,
      },
    },
    create: {
      tenantId,
      userId,
      entitlements,
    },
    update: {
      entitlements,
    },
  });
}

/**
 * Cache TTL constants (re-exported for convenience)
 */
export { CACHE_TTL };

