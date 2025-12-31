import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import paymentsClient from '../clients/payments.js';
import type { Entitlement, AppEntitlementsResponse } from '@accounts/shared';
import { isCacheStale, updateEntitlementCache, CACHE_TTL } from '../services/cache.service.js';

export async function entitlementsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /entitlements - Get user entitlements
  fastify.get('/entitlements', async (request, reply) => {
    const { auth } = request;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

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
    if (!entitlementCache || isCacheStale(entitlementCache, CACHE_TTL.ENTITLEMENTS)) {
      // Fetch from payments.mojo with fallback to stale cache
      try {
        const entitlements = await paymentsClient.getEntitlements(auth.userId, auth.activeTenant.id);

        entitlementCache = await updateEntitlementCache(
          auth.activeTenant.id,
          auth.userId,
          entitlements
        );
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
  fastify.get('/entitlements/apps', async (request, reply) => {
    const { auth } = request;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

    // Fetch app entitlements from payments.mojo
    const appEntitlements = await paymentsClient.getAppEntitlements(
      auth.userId,
      auth.activeTenant.id
    );

    return reply.send(appEntitlements);
  });

  // GET /entitlements/:resourceId - Check specific entitlement
  fastify.get<{ Params: { resourceId: string } }>('/entitlements/:resourceId', async (request, reply) => {
    const { auth } = request;
    const { resourceId } = request.params;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

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





