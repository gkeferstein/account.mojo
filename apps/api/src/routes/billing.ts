import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import paymentsClient from '../clients/payments.js';
import { logAuditEvent, AuditActions } from '../services/audit.js';
import env from '../lib/env.js';
import { isCacheStale, updateBillingCache, CACHE_TTL } from '../services/cache.service.js';

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
  fastify.get('/billing/subscription', async (request, reply) => {
    const { auth } = request;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

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
    if (!billingCache || isCacheStale(billingCache, CACHE_TTL.BILLING)) {
      // Fetch from payments.mojo with fallback to stale cache
      try {
        const subscription = await paymentsClient.getSubscription(auth.userId, auth.activeTenant.id);

        billingCache = await updateBillingCache(auth.activeTenant.id, auth.userId, {
          subscription: subscription || null,
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
  fastify.get('/billing/invoices', async (request, reply) => {
    const { auth } = request;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

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
    if (!billingCache?.invoices || isCacheStale(billingCache, CACHE_TTL.BILLING)) {
      // Fetch from payments.mojo with fallback to stale cache
      try {
        const invoices = await paymentsClient.getInvoices(auth.userId, auth.activeTenant.id);

        billingCache = await updateBillingCache(auth.activeTenant.id, auth.userId, {
          invoices,
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

  // POST /billing/portal - Create billing portal session
  fastify.post('/billing/portal', async (request, reply) => {
    const { auth } = request;
    const { returnUrl } = request.body as { returnUrl?: string };

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

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








