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
    // Body is already a string due to content type parser
    const rawBody = request.body as string;

    if (!rawBody) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing request body',
      });
    }

    if (!verifySignature(rawBody, signature, secret)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
    }
    
    // Parse body and attach to request for handlers
    try {
      (request as any).body = JSON.parse(rawBody);
    } catch (error) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid JSON in request body',
      });
    }
  };
}

export async function webhooksRoutes(fastify: FastifyInstance): Promise<void> {
  // Add content type parser for raw body (needed for signature verification)
  // This MUST be done before registering routes
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    done(null, body as string);
  });

  // POST /webhooks/payments - Handle payment events
  fastify.post('/payments', {
    preHandler: async (request, reply) => {
      await verifyWebhookSignature(env.WEBHOOK_SECRET_PAYMENTS)(request, reply);
    },
  }, async (request, reply) => {
    // Body is already parsed by verifyWebhookSignature middleware
    const payload = request.body as WebhookPayload;
    
    request.log.info({ event: payload.event }, 'Payment webhook received');

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
            request.log.warn({ clerkUserId: userId, event: payload.event }, 'User not found for webhook');
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

          request.log.info({ userId: user.id, event: payload.event }, 'Updated billing cache');
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

          request.log.info({ userId: user.id, event: payload.event }, 'Updated invoice cache');
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

          request.log.info({ userId: user.id, event: payload.event }, 'Updated entitlement cache');
          break;
        }

        default:
          request.log.warn({ event: payload.event }, 'Unhandled payment event');
      }

      return reply.send({ received: true, processed: true });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, event: payload.event }, 'Error processing payment webhook');
      return reply.status(500).send({ error: 'Internal error processing webhook' });
    }
  });

  // POST /webhooks/crm - Handle CRM events
  fastify.post('/crm', {
    preHandler: async (request, reply) => {
      await verifyWebhookSignature(env.WEBHOOK_SECRET_CRM)(request, reply);
    },
  }, async (request, reply) => {
    // Body is already parsed by verifyWebhookSignature middleware
    const payload = request.body as WebhookPayload;
    
    request.log.info({ event: payload.event }, 'CRM webhook received');

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
              payload: profile as any,
            },
            update: {
              payload: profile as any,
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

          request.log.info({ userId: user.id, event: payload.event }, 'Updated profile cache');
          break;
        }

        case 'consent.updated': {
          // Handle consent updates from CRM
          const { userId } = payload.data as { userId?: string };
          request.log.info(userId ? { userId } : {}, 'Consent update received, no local cache action needed');
          break;
        }

        default:
          request.log.warn({ event: payload.event }, 'Unhandled CRM event');
      }

      return reply.send({ received: true, processed: true });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, event: payload.event }, 'Error processing CRM webhook');
      return reply.status(500).send({ error: 'Internal error processing webhook' });
    }
  });
}

export default webhooksRoutes;








