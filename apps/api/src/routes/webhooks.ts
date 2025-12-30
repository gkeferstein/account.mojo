import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '../lib/prisma.js';
import env from '../lib/env.js';

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

// Verify webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;

  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(`sha256=${expectedSignature}`);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

// Middleware to verify webhook signatures
async function verifyWebhookSignature(secret: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['x-webhook-signature'] as string;
    const rawBody = JSON.stringify(request.body);

    if (!verifySignature(rawBody, signature, secret)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
    }
  };
}

export async function webhooksRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /webhooks/payments - Handle payment events
  fastify.post('/payments', {
    preHandler: async (request, reply) => {
      await verifyWebhookSignature(env.WEBHOOK_SECRET_PAYMENTS)(request, reply);
    },
  }, async (request, reply) => {
    const payload = request.body as WebhookPayload;
    
    request.log.info('Payment webhook received', { event: payload.event });

    try {
      switch (payload.event) {
        case 'subscription.created':
        case 'subscription.updated':
        case 'subscription.deleted': {
          const { userId, tenantId, subscription } = payload.data as {
            userId?: string;
            tenantId?: string;
            subscription: unknown;
          };

          if (!userId || !tenantId) {
            return reply.status(400).send({ error: 'Missing userId or tenantId' });
          }

          // Find internal user by clerkUserId
          const user = await prisma.user.findUnique({
            where: { clerkUserId: userId },
          });

          if (!user) {
            request.log.warn('User not found for webhook', { clerkUserId: userId, event: payload.event });
            return reply.send({ received: true, processed: false, reason: 'User not found' });
          }

          // Update billing cache
          await prisma.billingCache.upsert({
            where: {
              tenantId_userId: {
                tenantId,
                userId: user.id,
              },
            },
            create: {
              tenantId,
              userId: user.id,
              subscription,
            },
            update: {
              subscription: payload.event === 'subscription.deleted' ? null : subscription,
            },
          });

          request.log.info('Updated billing cache', { userId: user.id, event: payload.event });
          break;
        }

        case 'invoice.paid':
        case 'invoice.payment_failed': {
          const { userId, tenantId, invoice } = payload.data as {
            userId?: string;
            tenantId?: string;
            invoice: unknown;
          };

          if (!userId || !tenantId) {
            return reply.status(400).send({ error: 'Missing userId or tenantId' });
          }

          const user = await prisma.user.findUnique({
            where: { clerkUserId: userId },
          });

          if (!user) {
            return reply.send({ received: true, processed: false, reason: 'User not found' });
          }

          // Get current invoices and add new one
          const billingCache = await prisma.billingCache.findUnique({
            where: {
              tenantId_userId: {
                tenantId,
                userId: user.id,
              },
            },
          });

          const currentInvoices = (billingCache?.invoices as unknown[] || []);
          const updatedInvoices = [invoice, ...currentInvoices].slice(0, 50); // Keep last 50

          await prisma.billingCache.upsert({
            where: {
              tenantId_userId: {
                tenantId,
                userId: user.id,
              },
            },
            create: {
              tenantId,
              userId: user.id,
              invoices: updatedInvoices,
            },
            update: {
              invoices: updatedInvoices,
            },
          });

          request.log.info('Updated invoice cache', { userId: user.id, event: payload.event });
          break;
        }

        case 'entitlement.granted':
        case 'entitlement.revoked': {
          const { userId, tenantId, entitlements } = payload.data as {
            userId?: string;
            tenantId?: string;
            entitlements: unknown;
          };

          if (!userId || !tenantId) {
            return reply.status(400).send({ error: 'Missing userId or tenantId' });
          }

          const user = await prisma.user.findUnique({
            where: { clerkUserId: userId },
          });

          if (!user) {
            return reply.send({ received: true, processed: false, reason: 'User not found' });
          }

          await prisma.entitlementCache.upsert({
            where: {
              tenantId_userId: {
                tenantId,
                userId: user.id,
              },
            },
            create: {
              tenantId,
              userId: user.id,
              entitlements,
            },
            update: {
              entitlements,
            },
          });

          request.log.info('Updated entitlement cache', { userId: user.id, event: payload.event });
          break;
        }

        default:
          request.log.warn('Unhandled payment event', { event: payload.event });
      }

      return reply.send({ received: true, processed: true });
    } catch (error) {
      request.log.error('Error processing payment webhook', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        event: payload.event,
      });
      return reply.status(500).send({ error: 'Internal error processing webhook' });
    }
  });

  // POST /webhooks/crm - Handle CRM events
  fastify.post('/crm', {
    preHandler: async (request, reply) => {
      await verifyWebhookSignature(env.WEBHOOK_SECRET_CRM)(request, reply);
    },
  }, async (request, reply) => {
    const payload = request.body as WebhookPayload;
    
    request.log.info('CRM webhook received', { event: payload.event });

    try {
      switch (payload.event) {
        case 'contact.updated': {
          const { userId, tenantId, profile } = payload.data as {
            userId?: string;
            tenantId?: string;
            profile: unknown;
          };

          if (!userId || !tenantId) {
            return reply.status(400).send({ error: 'Missing userId or tenantId' });
          }

          const user = await prisma.user.findUnique({
            where: { clerkUserId: userId },
          });

          if (!user) {
            return reply.send({ received: true, processed: false, reason: 'User not found' });
          }

          // Update profile cache
          await prisma.profileCache.upsert({
            where: {
              tenantId_userId: {
                tenantId,
                userId: user.id,
              },
            },
            create: {
              tenantId,
              userId: user.id,
              payload: profile,
            },
            update: {
              payload: profile,
            },
          });

          // Update user record
          const profileData = profile as { firstName?: string; lastName?: string; email?: string };
          if (profileData.firstName || profileData.lastName) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                ...(profileData.firstName && { firstName: profileData.firstName }),
                ...(profileData.lastName && { lastName: profileData.lastName }),
              },
            });
          }

          request.log.info('Updated profile cache', { userId: user.id, event: payload.event });
          break;
        }

        case 'consent.updated': {
          // Handle consent updates from CRM
          request.log.info('Consent update received, no local cache action needed', { userId: user.id });
          break;
        }

        default:
          request.log.warn('Unhandled CRM event', { event: payload.event });
      }

      return reply.send({ received: true, processed: true });
    } catch (error) {
      request.log.error('Error processing CRM webhook', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        event: payload.event,
      });
      return reply.status(500).send({ error: 'Internal error processing webhook' });
    }
  });
}

export default webhooksRoutes;






