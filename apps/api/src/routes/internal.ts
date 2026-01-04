import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'crypto';
import prisma from '../lib/prisma.js';
import env from '../lib/env.js';
import { appLogger } from '../lib/logger.js';

// Internal API Authentication Middleware
async function internalAuthMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.headers['x-internal-token'] as string;

  if (!token) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing X-Internal-Token header',
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  const secretBuffer = Buffer.from(env.INTERNAL_API_SECRET, 'utf8');
  const tokenBuffer = Buffer.from(token, 'utf8');

  if (secretBuffer.length !== tokenBuffer.length) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid internal API token',
    });
  }

  if (!timingSafeEqual(secretBuffer, tokenBuffer)) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid internal API token',
    });
  }
}

export async function internalRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply internal auth middleware to all routes
  fastify.addHook('preHandler', internalAuthMiddleware);

  // ==========================================
  // User Endpoints
  // ==========================================

  // GET /internal/users/:clerkUserId - Get user by Clerk ID
  fastify.get('/users/:clerkUserId', async (request, reply) => {
    const { clerkUserId } = request.params as { clerkUserId: string };

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        platformRole: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      // Don't expose clerkUserId in error message (security: information disclosure)
      request.log.warn({ clerkUserId }, 'User not found in internal API');
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    return reply.send({ user });
  });

  // GET /internal/users/:clerkUserId/tenants - Get user's tenants
  fastify.get('/users/:clerkUserId/tenants', async (request, reply) => {
    const { clerkUserId } = request.params as { clerkUserId: string };

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      // Don't expose clerkUserId in error message (security: information disclosure)
      request.log.warn({ clerkUserId }, 'User not found in internal API');
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    const memberships = await prisma.tenantMembership.findMany({
      where: {
        userId: user.id,
        status: 'active',
      },
      include: {
        tenant: {
          select: {
            id: true,
            clerkOrgId: true,
            name: true,
            slug: true,
            logoUrl: true,
            isPersonal: true,
            createdAt: true,
            deletedAt: true,
          },
        },
      },
    });

    const tenants = memberships.map((m) => ({
      ...m.tenant,
      role: m.role,
      membershipId: m.id,
      clerkMembershipId: m.clerkMembershipId,
    }));

    return reply.send({ tenants });
  });

  // ==========================================
  // Tenant Endpoints
  // ==========================================

  // GET /internal/tenants/:clerkOrgId - Get tenant by Clerk Org ID
  fastify.get('/tenants/:clerkOrgId', async (request, reply) => {
    const { clerkOrgId } = request.params as { clerkOrgId: string };

    const tenant = await prisma.tenant.findUnique({
      where: { clerkOrgId },
      select: {
        id: true,
        clerkOrgId: true,
        name: true,
        slug: true,
        logoUrl: true,
        isPersonal: true,
        ownerUserId: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!tenant) {
      // Don't expose clerkOrgId in error message (security: information disclosure)
      request.log.warn({ clerkOrgId }, 'Tenant not found in internal API');
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    // Get owner details if available
    let owner = null;
    if (tenant.ownerUserId) {
      owner = await prisma.user.findUnique({
        where: { id: tenant.ownerUserId },
        select: {
          id: true,
          clerkUserId: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
    }

    return reply.send({ tenant: { ...tenant, owner } });
  });

  // GET /internal/tenants/:clerkOrgId/memberships - Get tenant's members
  fastify.get('/tenants/:clerkOrgId/memberships', async (request, reply) => {
    const { clerkOrgId } = request.params as { clerkOrgId: string };

    const tenant = await prisma.tenant.findUnique({
      where: { clerkOrgId },
    });

    if (!tenant) {
      // Don't expose clerkOrgId in error message (security: information disclosure)
      request.log.warn({ clerkOrgId }, 'Tenant not found in internal API');
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Tenant not found',
      });
    }

    const memberships = await prisma.tenantMembership.findMany({
      where: {
        tenantId: tenant.id,
      },
      include: {
        user: {
          select: {
            id: true,
            clerkUserId: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const members = memberships.map((m) => ({
      membershipId: m.id,
      clerkMembershipId: m.clerkMembershipId,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
      user: m.user,
    }));

    return reply.send({ members });
  });

  // ==========================================
  // Lookup Endpoints (for admin/support)
  // ==========================================

  // GET /internal/lookup/email/:email - Find user by email
  fastify.get('/lookup/email/:email', async (request, reply) => {
    const { email } = request.params as { email: string };

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        platformRole: true,
        createdAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `User not found with email: ${email}`,
      });
    }

    return reply.send({ user });
  });

  // GET /internal/lookup/slug/:slug - Find tenant by slug
  fastify.get('/lookup/slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        clerkOrgId: true,
        name: true,
        slug: true,
        logoUrl: true,
        isPersonal: true,
        createdAt: true,
        deletedAt: true,
      },
    });

    if (!tenant) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Tenant not found with slug: ${slug}`,
      });
    }

    return reply.send({ tenant });
  });

  // ==========================================
  // Health & Status
  // ==========================================

  // GET /internal/health - Internal API health check
  fastify.get('/health', async (_request, reply) => {
    const userCount = await prisma.user.count();
    const tenantCount = await prisma.tenant.count();
    const membershipCount = await prisma.tenantMembership.count();

    return reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      stats: {
        users: userCount,
        tenants: tenantCount,
        memberships: membershipCount,
      },
    });
  });

  // GET /internal/webhook-events - Get recent webhook events (for debugging)
  fastify.get('/webhook-events', async (request, reply) => {
    const { limit = '50', status } = request.query as { limit?: string; status?: string };

    const events = await prisma.webhookEvent.findMany({
      where: status ? { status: status as 'pending' | 'processing' | 'success' | 'failed' } : undefined,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
      select: {
        id: true,
        eventId: true,
        eventType: true,
        source: true,
        status: true,
        errorMessage: true,
        attemptCount: true,
        processedAt: true,
        createdAt: true,
      },
    });

    return reply.send({ events });
  });

  // ==========================================
  // Email Service Endpoints
  // ==========================================

  // POST /internal/email/send - Send email (for payments.mojo, kontakte.mojo, etc.)
  fastify.post('/email/send', async (request, reply) => {
    const body = request.body as {
      to: string | string[];
      subject: string;
      template: string;
      data: Record<string, any>;
      from?: string;
      replyTo?: string;
      tags?: string[];
      metadata?: Record<string, string>;
      checkPreferences?: {
        clerkUserId?: string;
        tenantId?: string;
        preferenceType?: 'newsletter' | 'marketingEmails' | 'productUpdates' | 'emailNotifications';
      };
    };

    // Validate required fields
    if (!body.to || !body.subject || !body.template) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing required fields: to, subject, template',
      });
    }

    try {
      const { sendEmail } = await import('../services/email.service.js');
      const result = await sendEmail({
        to: body.to,
        subject: body.subject,
        template: body.template as any,
        data: body.data || {},
        from: body.from,
        replyTo: body.replyTo,
        tags: body.tags ? body.tags.map(t => typeof t === 'string' ? { name: t, value: t } : t) : undefined,
        checkPreferences: body.checkPreferences,
      });

      if (result.success) {
        return reply.send({
          success: true,
          messageId: result.messageId,
          skipped: result.messageId === 'skipped',
        });
      } else {
        return reply.status(500).send({
          error: 'Failed to send email',
          message: result.error,
        });
      }
    } catch (error) {
      appLogger.error('Failed to send email via internal API', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

export default internalRoutes;








