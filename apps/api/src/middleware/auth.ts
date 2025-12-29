/**
 * Authentication Middleware for accounts.mojo
 * 
 * Validates Clerk JWT tokens and resolves tenant context.
 * accounts.mojo is the SSOT for tenant data - other services sync from here.
 * 
 * Uses @mojo/tenant for consistent tenant types across services.
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { createClerkClient, verifyToken } from '@clerk/backend';
import prisma from '../lib/prisma.js';
import env from '../lib/env.js';
import type { User, Tenant, TenantMembership, TenantRole } from '@prisma/client';
import { Tenant as MojoTenant, TenantContext, TENANT_HEADERS, createTenantHeaders } from '@mojo/tenant';

// Extend Fastify request with auth context
declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
    /** @mojo/tenant compatible tenant context */
    tenantContext: TenantContext | null;
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

/**
 * Convert Prisma Tenant to @mojo/tenant Tenant interface
 */
function toMojoTenant(tenant: Tenant): MojoTenant {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    clerkOrgId: tenant.clerkOrgId ?? undefined,
    isPersonal: tenant.isPersonal ?? false,
    status: 'active', // accounts.mojo doesn't have status yet
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

// Get or create user from Clerk JWT
// NOTE: Personal tenant provisioning is now handled via Clerk webhooks (clerk-webhooks.ts)
// This function only creates/updates the user record for JWT-based auth
async function getOrCreateUser(clerkUserId: string, email: string, firstName?: string | null, lastName?: string | null, avatarUrl?: string | null): Promise<User> {
  let user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    // Create new user (personal tenant will be created via webhook)
    user = await prisma.user.create({
      data: {
        clerkUserId,
        email,
        firstName,
        lastName,
        avatarUrl,
      },
    });
    console.log(`📝 User created via JWT auth: ${clerkUserId} (webhook will provision personal org)`);
  } else {
    // Update user info if changed
    if (user.email !== email || user.firstName !== firstName || user.lastName !== lastName || user.avatarUrl !== avatarUrl) {
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
      clerkMembershipId: m.clerkMembershipId,
      tenantId: m.tenantId,
      userId: m.userId,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    },
  }));
}

// Map Clerk org to tenant (lookup only - creation happens via webhook)
// NOTE: Tenant and membership creation is now handled via Clerk webhooks (clerk-webhooks.ts)
async function mapClerkOrgToTenant(clerkOrgId: string, _user: User): Promise<Tenant | null> {
  if (!clerkOrgId) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { clerkOrgId },
  });

  if (!tenant) {
    // Tenant should be created via webhook - log warning if not found
    console.warn(`⚠️ Tenant not found for clerkOrgId: ${clerkOrgId} (should be created via webhook)`);
    return null;
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

        // Set @mojo/tenant compatible context
        request.tenantContext = activeTenant ? {
          tenant: toMojoTenant(activeTenant),
          source: 'default',
        } : null;

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

    // Set @mojo/tenant compatible context
    request.tenantContext = activeTenant ? {
      tenant: toMojoTenant(activeTenant),
      source: clerkOrgId ? 'jwt_org_id' : 'default',
      rawIdentifier: clerkOrgId || undefined,
    } : null;

  } catch (error) {
    console.error('Auth error:', error);
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' });
  }
}

// Register auth decorator
export function registerAuthPlugin(fastify: FastifyInstance): void {
  fastify.decorateRequest('auth', null);
  fastify.decorateRequest('tenantContext', null);
}

/**
 * Create headers for calling other MOJO services
 * Uses the standardized @mojo/tenant header format
 */
export function createServiceHeaders(tenant: Tenant): Record<string, string> {
  return createTenantHeaders(toMojoTenant(tenant), 'accounts.mojo');
}

export default authMiddleware;
