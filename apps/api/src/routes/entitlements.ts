import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import paymentsClient from '../clients/payments.js';
import type { Entitlement } from '@accounts/shared';

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
    const cacheAge = entitlementCache ? Date.now() - entitlementCache.updatedAt.getTime() : Infinity;
    const cacheStale = cacheAge > 5 * 60 * 1000;

    if (!entitlementCache || cacheStale) {
      const entitlements = await paymentsClient.getEntitlements(auth.userId, auth.activeTenant.id);

      entitlementCache = await prisma.entitlementCache.upsert({
        where: {
          tenantId_userId: {
            tenantId: auth.activeTenant.id,
            userId: auth.userId,
          },
        },
        create: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
          entitlements,
        },
        update: {
          entitlements,
        },
      });
    }

    const entitlements = (entitlementCache.entitlements as Entitlement[]) || [];

    // Group by type
    const grouped = {
      courseAccess: entitlements.filter((e) => e.type === 'course_access'),
      featureFlags: entitlements.filter((e) => e.type === 'feature_flag'),
      resourceLimits: entitlements.filter((e) => e.type === 'resource_limit'),
    };

    return reply.send({
      entitlements,
      grouped,
      total: entitlements.length,
    });
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
      const entitlements = await paymentsClient.getEntitlements(auth.userId, auth.activeTenant.id);

      entitlementCache = await prisma.entitlementCache.upsert({
        where: {
          tenantId_userId: {
            tenantId: auth.activeTenant.id,
            userId: auth.userId,
          },
        },
        create: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
          entitlements,
        },
        update: {
          entitlements,
        },
      });
    }

    const entitlements = (entitlementCache.entitlements as Entitlement[]) || [];
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


