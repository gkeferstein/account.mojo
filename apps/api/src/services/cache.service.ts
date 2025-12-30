/**
 * Cache Service
 * Centralizes cache management logic to reduce duplication
 */

import { CACHE_TTL } from '../lib/constants.js';
import prisma from '../lib/prisma.js';

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
 */
export async function updateCache<T>(
  model: any,
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
 * Update ProfileCache
 */
export async function updateProfileCache(
  tenantId: string,
  userId: string,
  profile: any
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
    subscription?: any;
    invoices?: any;
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
  entitlements: any[]
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

