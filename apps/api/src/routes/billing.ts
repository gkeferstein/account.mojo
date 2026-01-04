import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import paymentsClient from '../clients/payments.js';
import { logAuditEvent, AuditActions } from '../services/audit.js';
import env from '../lib/env.js';
import { isCacheStale, updateBillingCache, CACHE_TTL, withSingleFlight } from '../services/cache.service.js';
import { requireActiveTenant } from '../middleware/active-tenant.js';

// Validate returnUrl to prevent open redirect vulnerability
function validateReturnUrl(url: string | undefined): string {
  const defaultUrl = `${env.FRONTEND_URL}/membership`;

  if (!url) {
    return defaultUrl;
  }

  try {
    const urlObj = new URL(url);

    // Only allow same origin as frontend
    const allowedOrigin = new URL(env.FRONTEND_URL).origin;
    if (urlObj.origin !== allowedOrigin) {
      return defaultUrl;
    }

    // Ensure it's using http/https (not javascript:, data:, etc.)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return defaultUrl;
    }

    return url;
  } catch {
    // Invalid URL, use default
    return defaultUrl;
  }
}

export async function billingRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /billing/subscription - Get current subscription
  fastify.get('/billing/subscription', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
    const { auth } = request;

    // Try cache first
    let billingCache = await prisma.billingCache.findUnique({
      where: {
        tenantId_userId: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
        },
      },
    });

    // Refresh if cache is stale (older than 1 minute)
    // Use Single-Flight Pattern to prevent concurrent refresh requests
    if (!billingCache || isCacheStale(billingCache, CACHE_TTL.BILLING)) {
      const cacheKey = `billing:subscription:${auth.activeTenant.id}:${auth.userId}`;
      
      try {
        // Single-Flight: Only one request will fetch, others wait
        billingCache = await withSingleFlight(cacheKey, async () => {
          const subscription = await paymentsClient.getSubscription(auth.userId, auth.activeTenant.id);

          return await updateBillingCache(auth.activeTenant.id, auth.userId, {
            subscription: subscription || null,
          });
        });
      } catch (error) {
        // Fallback: Use stale cache if available
        request.log.warn({
          err: error,
          message: 'Failed to refresh subscription from payments.mojo, using cache if available',
          userId: auth.userId,
          hasStaleCache: !!billingCache,
        });
        
        // If no cache available, subscription will be null
        if (!billingCache) {
          // Create empty cache entry to prevent repeated failures
          billingCache = await prisma.billingCache.create({
            data: {
              tenantId: auth.activeTenant.id,
              userId: auth.userId,
              subscription: null,
            },
          });
        }
      }
    }

    await logAuditEvent(request, {
      action: AuditActions.BILLING_VIEW,
    });

    return reply.send({
      subscription: billingCache.subscription,
    });
  });

  // GET /billing/invoices - Get invoices
  fastify.get('/billing/invoices', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
    const { auth } = request;

    // Try cache first
    let billingCache = await prisma.billingCache.findUnique({
      where: {
        tenantId_userId: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
        },
      },
    });

    // Refresh if cache is stale
    // Use Single-Flight Pattern to prevent concurrent refresh requests
    if (!billingCache?.invoices || isCacheStale(billingCache, CACHE_TTL.BILLING)) {
      const cacheKey = `billing:invoices:${auth.activeTenant.id}:${auth.userId}`;
      
      try {
        // Single-Flight: Only one request will fetch, others wait
        billingCache = await withSingleFlight(cacheKey, async () => {
          const invoices = await paymentsClient.getInvoices(auth.userId, auth.activeTenant.id);

          return await updateBillingCache(auth.activeTenant.id, auth.userId, {
            invoices,
          });
        });
      } catch (error) {
        // Fallback: Use stale cache if available
        request.log.warn({
          err: error,
          message: 'Failed to refresh invoices from payments.mojo, using cache if available',
          userId: auth.userId,
          hasStaleCache: !!billingCache?.invoices,
        });
        
        // If no cache available, invoices will be empty array
        if (!billingCache) {
          billingCache = await prisma.billingCache.create({
            data: {
              tenantId: auth.activeTenant.id,
              userId: auth.userId,
              invoices: [],
            },
          });
        }
      }
    }

    return reply.send({
      invoices: billingCache.invoices || [],
    });
  });

  // GET /billing/statements - Get revenue statements
  fastify.get('/billing/statements', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
    const { auth } = request;

    try {
      const statements = await paymentsClient.getStatements(auth.userId, auth.activeTenant.id);
      return reply.send({ statements });
    } catch (error) {
      request.log.error({
        err: error,
        message: 'Failed to fetch statements from payments.mojo',
        userId: auth.userId,
      });
      return reply.status(500).send({
        error: 'Server Error',
        message: 'Failed to fetch statements',
      });
    }
  });

  // POST /billing/portal - Create billing portal session
  fastify.post('/billing/portal', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
    const { auth } = request;
    const { returnUrl } = request.body as { returnUrl?: string };

    // Validate returnUrl to prevent open redirect vulnerability
    const finalReturnUrl = validateReturnUrl(returnUrl);

    const portalSession = await paymentsClient.createBillingPortalSession(
      auth.userId,
      auth.activeTenant.id,
      finalReturnUrl
    );

    await logAuditEvent(request, {
      action: AuditActions.BILLING_PORTAL_ACCESS,
    });

    return reply.send({
      url: portalSession.url,
      expiresAt: portalSession.expiresAt,
    });
  });
}

export default billingRoutes;








