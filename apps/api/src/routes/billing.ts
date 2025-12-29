import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import paymentsClient from '../clients/payments.js';
import { logAuditEvent, AuditActions } from '../services/audit.js';
import env from '../lib/env.js';

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
    const cacheAge = billingCache ? Date.now() - billingCache.updatedAt.getTime() : Infinity;
    const cacheStale = cacheAge > 60 * 1000;

    if (!billingCache || cacheStale) {
      const subscription = await paymentsClient.getSubscription(auth.userId, auth.activeTenant.id);

      billingCache = await prisma.billingCache.upsert({
        where: {
          tenantId_userId: {
            tenantId: auth.activeTenant.id,
            userId: auth.userId,
          },
        },
        create: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
          subscription: subscription || null,
        },
        update: {
          subscription: subscription || null,
        },
      });
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
    const cacheAge = billingCache ? Date.now() - billingCache.updatedAt.getTime() : Infinity;
    const cacheStale = cacheAge > 60 * 1000;

    if (!billingCache?.invoices || cacheStale) {
      const invoices = await paymentsClient.getInvoices(auth.userId, auth.activeTenant.id);

      billingCache = await prisma.billingCache.upsert({
        where: {
          tenantId_userId: {
            tenantId: auth.activeTenant.id,
            userId: auth.userId,
          },
        },
        create: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
          invoices,
        },
        update: {
          invoices,
        },
      });
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

    const finalReturnUrl = returnUrl || `${env.FRONTEND_URL}/membership`;

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





