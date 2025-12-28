import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { createClerkClient, verifyToken } from '@clerk/backend';
import prisma from '../lib/prisma.js';
import env from '../lib/env.js';
import type { User, Tenant, TenantMembership, TenantRole } from '@prisma/client';

// Extend Fastify request with auth context
declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export interface AuthContext {
  userId: string;
  clerkUserId: string;
  clerkOrgId: string | null;
  user: User;
  activeTenant: Tenant | null;
  activeMembership: TenantMembership | null;
  tenants: Array<Tenant & { membership: TenantMembership }>;
}

// Initialize Clerk client
const clerkClient = env.CLERK_SECRET_KEY 
  ? createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
  : null;

// Get or create user from Clerk JWT
async function getOrCreateUser(clerkUserId: string, email: string, firstName?: string | null, lastName?: string | null, avatarUrl?: string | null): Promise<User> {
  let user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    // Create new user
    user = await prisma.user.create({
      data: {
        clerkUserId,
        email,
        firstName,
        lastName,
        avatarUrl,
      },
    });

    // Create personal tenant for new user
    const personalTenant = await prisma.tenant.create({
      data: {
        name: `${firstName || email.split('@')[0]}'s Account`,
        slug: `personal-${clerkUserId.replace('user_', '')}`,
        isPersonal: true,
      },
    });

    // Create owner membership
    await prisma.tenantMembership.create({
      data: {
        tenantId: personalTenant.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      },
    });

    // Create default preferences
    await prisma.preferences.create({
      data: {
        tenantId: personalTenant.id,
        userId: user.id,
      },
    });
  } else {
    // Update user info if changed
    if (user.email !== email || user.firstName !== firstName || user.lastName !== lastName) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email, firstName, lastName, avatarUrl },
      });
    }
  }

  return user;
}

// Get user's tenants with memberships
async function getUserTenants(userId: string): Promise<Array<Tenant & { membership: TenantMembership }>> {
  const memberships = await prisma.tenantMembership.findMany({
    where: {
      userId,
      status: 'active',
    },
    include: {
      tenant: true,
    },
  });

  return memberships.map((m) => ({
    ...m.tenant,
    membership: {
      id: m.id,
      tenantId: m.tenantId,
      userId: m.userId,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    },
  }));
}

// Map Clerk org to tenant (create if needed)
async function mapClerkOrgToTenant(clerkOrgId: string, user: User): Promise<Tenant | null> {
  if (!clerkOrgId) return null;

  let tenant = await prisma.tenant.findUnique({
    where: { clerkOrgId },
  });

  if (!tenant && clerkClient) {
    // Get org details from Clerk
    try {
      const org = await clerkClient.organizations.getOrganization({ organizationId: clerkOrgId });
      
      // Create tenant for this org
      tenant = await prisma.tenant.create({
        data: {
          name: org.name,
          slug: org.slug || `org-${clerkOrgId.replace('org_', '')}`,
          clerkOrgId,
          logoUrl: org.imageUrl,
          isPersonal: false,
        },
      });

      // Create owner membership for current user
      await prisma.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'owner',
          status: 'active',
        },
      });
    } catch (error) {
      console.error('Failed to fetch Clerk organization:', error);
      return null;
    }
  }

  return tenant;
}

// Auth middleware
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);

    // In development without Clerk, allow mock auth
    if (!env.CLERK_SECRET_KEY && env.NODE_ENV === 'development') {
      const mockUser = await prisma.user.findFirst({
        where: { email: 'demo@mojo-institut.de' },
      });

      if (mockUser) {
        const tenants = await getUserTenants(mockUser.id);
        const activeTenant = tenants[0] || null;

        request.auth = {
          userId: mockUser.id,
          clerkUserId: mockUser.clerkUserId,
          clerkOrgId: null,
          user: mockUser,
          activeTenant,
          activeMembership: activeTenant?.membership || null,
          tenants,
        };
        return;
      }
    }

    // Verify JWT with Clerk
    if (!env.CLERK_SECRET_KEY) {
      return reply.status(500).send({ error: 'Server Error', message: 'Clerk not configured' });
    }

    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    const clerkUserId = payload.sub;
    const clerkOrgId = (payload as { org_id?: string }).org_id || null;
    const email = (payload as { email?: string }).email || '';
    const firstName = (payload as { first_name?: string }).first_name || null;
    const lastName = (payload as { last_name?: string }).last_name || null;
    const avatarUrl = (payload as { image_url?: string }).image_url || null;

    // Get or create user
    const user = await getOrCreateUser(clerkUserId, email, firstName, lastName, avatarUrl);

    // Get user's tenants
    const tenants = await getUserTenants(user.id);

    // Map Clerk org to tenant if present
    let activeTenant: Tenant | null = null;
    let activeMembership: TenantMembership | null = null;

    if (clerkOrgId) {
      activeTenant = await mapClerkOrgToTenant(clerkOrgId, user);
      if (activeTenant) {
        const membership = await prisma.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: activeTenant.id,
              userId: user.id,
            },
          },
        });
        activeMembership = membership;
      }
    }

    // If no active org, default to personal tenant
    if (!activeTenant) {
      const personalTenant = tenants.find((t) => t.isPersonal);
      if (personalTenant) {
        activeTenant = personalTenant;
        activeMembership = personalTenant.membership;
      }
    }

    request.auth = {
      userId: user.id,
      clerkUserId,
      clerkOrgId,
      user,
      activeTenant,
      activeMembership,
      tenants,
    };
  } catch (error) {
    console.error('Auth error:', error);
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' });
  }
}

// Register auth decorator
export function registerAuthPlugin(fastify: FastifyInstance): void {
  fastify.decorateRequest('auth', null);
}

export default authMiddleware;

