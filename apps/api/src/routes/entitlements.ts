import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import paymentsClient from '../clients/payments.js';
import type { Entitlement, AppEntitlementsResponse } from '@accounts/shared';
import { isCacheStale, updateEntitlementCache, CACHE_TTL, withSingleFlight } from '../services/cache.service.js';
import { requireActiveTenant } from '../middleware/active-tenant.js';

export async function entitlementsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /entitlements - Get user entitlements
  fastify.get('/entitlements', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
    const { auth } = request;

    // Try cache first
    let entitlementCache = await prisma.entitlementCache.findUnique({
      where: {
        tenantId_userId: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
        },
      },
    });

    // Refresh if cache is stale (older than 5 minutes)
    // Use Single-Flight Pattern to prevent concurrent refresh requests
    if (!entitlementCache || isCacheStale(entitlementCache, CACHE_TTL.ENTITLEMENTS)) {
      const cacheKey = `entitlements:${auth.activeTenant.id}:${auth.userId}`;
      
      try {
        // Single-Flight: Only one request will fetch, others wait
        entitlementCache = await withSingleFlight(cacheKey, async () => {
          const entitlements = await paymentsClient.getEntitlements(auth.userId, auth.activeTenant.id);

          return await updateEntitlementCache(
            auth.activeTenant.id,
            auth.userId,
            entitlements
          );
        });
      } catch (error) {
        // Fallback: Use stale cache if available
        request.log.warn({
          err: error,
          message: 'Failed to refresh entitlements from payments.mojo, using cache if available',
          userId: auth.userId,
          hasStaleCache: !!entitlementCache,
        });
        
        // If no cache available, entitlements will be empty array
        if (!entitlementCache) {
          entitlementCache = await prisma.entitlementCache.create({
            data: {
              tenantId: auth.activeTenant.id,
              userId: auth.userId,
              entitlements: [],
            },
          });
        }
      }
    }

    const entitlements = (entitlementCache.entitlements as unknown as Entitlement[]) || [];

    // Group by type (matching new payments.mojo resource_types)
    const grouped = {
      courses: entitlements.filter((e) => e.type === 'course'),
      memberships: entitlements.filter((e) => e.type === 'membership'),
      features: entitlements.filter((e) => e.type === 'feature'),
      appAccess: entitlements.filter((e) => e.type === 'app_access'),
      bundles: entitlements.filter((e) => e.type === 'bundle'),
      services: entitlements.filter((e) => e.type === 'service'),
    };

    return reply.send({
      entitlements,
      grouped,
      total: entitlements.length,
    });
  });

  // GET /entitlements/apps - Get app access entitlements for navigation
  // Returns the entitlement strings needed by MojoGlobalHeader
  fastify.get('/entitlements/apps', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
    const { auth } = request;

    // Fetch app entitlements from payments.mojo
    const appEntitlements = await paymentsClient.getAppEntitlements(
      auth.userId,
      auth.activeTenant.id
    );

    return reply.send(appEntitlements);
  });

  // GET /entitlements/:resourceId - Check specific entitlement
  fastify.get<{ Params: { resourceId: string } }>(
    '/entitlements/:resourceId',
    { preHandler: [requireActiveTenant()] },
    async (request, reply) => {
      const { auth } = request;
      const { resourceId } = request.params;

    // Get entitlements from cache or refresh
    let entitlementCache = await prisma.entitlementCache.findUnique({
      where: {
        tenantId_userId: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
        },
      },
    });

    if (!entitlementCache) {
      // Try to fetch, but fallback gracefully if it fails
      try {
        const entitlements = await paymentsClient.getEntitlements(auth.userId, auth.activeTenant.id);

        entitlementCache = await updateEntitlementCache(
          auth.activeTenant.id,
          auth.userId,
          entitlements
        );
      } catch (error) {
        request.log.warn({
          err: error,
          message: 'Failed to fetch entitlements from payments.mojo',
          userId: auth.userId,
        });
        
        // Create empty cache entry
        entitlementCache = await prisma.entitlementCache.create({
          data: {
            tenantId: auth.activeTenant.id,
            userId: auth.userId,
            entitlements: [],
          },
        });
      }
    }

    const entitlements = (entitlementCache.entitlements as unknown as Entitlement[]) || [];
    const entitlement = entitlements.find((e) => e.resourceId === resourceId);

    if (!entitlement) {
      return reply.send({
        hasAccess: false,
        entitlement: null,
      });
    }

    // Check if expired
    const isExpired = entitlement.expiresAt && new Date(entitlement.expiresAt) < new Date();

    return reply.send({
      hasAccess: !isExpired,
      entitlement,
      isExpired,
    });
  });
}

export default entitlementsRoutes;





