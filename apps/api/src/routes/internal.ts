import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import env from '../lib/env.js';

// Internal API Authentication Middleware
async function internalAuthMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.headers['x-internal-token'] as string;

  if (!token) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing X-Internal-Token header',
    });
  }

  if (token !== env.INTERNAL_API_SECRET) {
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
      return reply.status(404).send({
        error: 'Not Found',
        message: `User not found: ${clerkUserId}`,
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
      return reply.status(404).send({
        error: 'Not Found',
        message: `User not found: ${clerkUserId}`,
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
      return reply.status(404).send({
        error: 'Not Found',
        message: `Tenant not found: ${clerkOrgId}`,
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
      return reply.status(404).send({
        error: 'Not Found',
        message: `Tenant not found: ${clerkOrgId}`,
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
}

export default internalRoutes;


