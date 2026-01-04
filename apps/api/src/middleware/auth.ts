/**
 * Authentication Middleware for accounts.mojo
 * 
 * Validates Clerk JWT tokens and resolves tenant context.
 * accounts.mojo is the SSOT for tenant data - other services sync from here.
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { createClerkClient, verifyToken } from '@clerk/backend';
import prisma from '../lib/prisma.js';
import env from '../lib/env.js';
import { TENANT_HEADERS } from '../lib/constants.js';
import { appLogger } from '../lib/logger.js';
import type { User, Tenant, TenantMembership, TenantRole } from '@prisma/client';

// Local tenant types (accounts.mojo is the SSOT, so we define them here)
interface MojoTenant {
  id: string;
  slug: string;
  name: string;
  clerkOrgId?: string;
  isPersonal: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TenantContext {
  tenant: MojoTenant;
  source: 'header' | 'jwt_org_id' | 'default';
  rawIdentifier?: string;
}

function createTenantHeaders(tenant: MojoTenant, serviceName: string): Record<string, string> {
  return {
    [TENANT_HEADERS.TENANT_ID]: tenant.id,
    [TENANT_HEADERS.TENANT_SLUG]: tenant.slug,
    [TENANT_HEADERS.SERVICE_NAME]: serviceName,
  };
}

// Extend Fastify request with auth context
declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
    /** @gkeferstein/tenant compatible tenant context */
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
 * Convert Prisma Tenant to @gkeferstein/tenant Tenant interface
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
// Also ensures a personal tenant exists (fallback if webhook failed)
async function getOrCreateUser(clerkUserId: string, email: string, firstName?: string | null, lastName?: string | null, avatarUrl?: string | null): Promise<User> {
  // First, try to find by clerkUserId
  let user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  // If not found by clerkUserId, try to find by email (in case clerkUserId changed)
  if (!user && email) {
    user = await prisma.user.findUnique({
      where: { email },
    });
    
    // If found by email but clerkUserId doesn't match, update it
    if (user && user.clerkUserId !== clerkUserId) {
      appLogger.warn('User found by email but clerkUserId mismatch, updating', {
        userId: user.id,
        oldClerkUserId: user.clerkUserId,
        newClerkUserId: clerkUserId,
      });
      user = await prisma.user.update({
        where: { id: user.id },
        data: { clerkUserId },
      });
    }
  }

  if (!user) {
    // Create new user
    try {
      user = await prisma.user.create({
        data: {
          clerkUserId,
          email,
          firstName,
          lastName,
          avatarUrl,
        },
      });
      appLogger.info('User created via JWT auth', { clerkUserId });
    } catch (error: any) {
      // If unique constraint fails (email already exists), try to find and update
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        appLogger.warn('User creation failed due to email conflict, trying to find and update', {
          email,
          clerkUserId,
        });
        user = await prisma.user.findUnique({
          where: { email },
        });
        if (user) {
          // Update existing user with new clerkUserId
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              clerkUserId,
              firstName,
              lastName,
              avatarUrl,
            },
          });
          appLogger.info('User updated with new clerkUserId', { userId: user.id, clerkUserId });
        } else {
          throw error; // Re-throw if we can't find the user
        }
      } else {
        throw error; // Re-throw other errors
      }
    }
  } else {
    // Update user info if changed
    if (user.email !== email || user.firstName !== firstName || user.lastName !== lastName || user.avatarUrl !== avatarUrl) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email, firstName, lastName, avatarUrl },
      });
    }
  }

  // Ensure personal tenant exists (fallback if webhook didn't create it)
  await ensurePersonalTenant(user);

  return user;
}

// Ensure user has a personal tenant (fallback for webhook failures)
async function ensurePersonalTenant(user: User): Promise<void> {
  // Check if user already has a personal tenant
  const existingMembership = await prisma.tenantMembership.findFirst({
    where: {
      userId: user.id,
      tenant: {
        isPersonal: true,
      },
    },
    include: {
      tenant: true,
    },
  });

  if (existingMembership) {
    return; // Personal tenant already exists
  }

  // Create personal tenant
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Persönliches Konto';
  const slug = `personal-${user.id.slice(0, 8)}`;

  const tenant = await prisma.tenant.create({
    data: {
      name: displayName,
      slug,
      isPersonal: true,
    },
  });

  // Create membership with owner role
  await prisma.tenantMembership.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      role: 'owner',
      status: 'active',
    },
  });

  appLogger.info('Personal tenant created as fallback', {
    userId: user.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
  });
}

// Sync all user organizations from Clerk to our database
// This ensures all organizations the user is a member of are available as tenants
async function syncUserOrganizationsFromClerk(user: User): Promise<void> {
  if (!clerkClient) {
    return; // Skip if Clerk client not available
  }

  try {
    // Fetch all organization memberships from Clerk
    const membershipList = await clerkClient.users.getOrganizationMembershipList({
      userId: user.clerkUserId,
    });

    // Sync each organization
    for (const clerkMembership of membershipList.data) {
      const clerkOrgId = clerkMembership.organization.id;
      
      // Check if tenant already exists
      let tenant = await prisma.tenant.findUnique({
        where: { clerkOrgId },
      });

      // Create tenant if it doesn't exist
      if (!tenant) {
        try {
          const org = await clerkClient.organizations.getOrganization({ organizationId: clerkOrgId });
          
          tenant = await prisma.tenant.create({
            data: {
              clerkOrgId,
              name: org.name,
              slug: org.slug || `org-${clerkOrgId.replace('org_', '')}`,
              logoUrl: org.imageUrl,
              isPersonal: false,
            },
          });
          
          appLogger.info('Tenant synced from Clerk', {
            tenantId: tenant.id,
            clerkOrgId,
            name: tenant.name,
            userId: user.id,
          });
        } catch (error) {
          appLogger.error('Failed to sync tenant from Clerk', {
            error: error instanceof Error ? error.message : String(error),
            clerkOrgId,
            userId: user.id,
          });
          continue; // Skip this organization and continue with others
        }
      }

      // Ensure membership exists
      if (tenant) {
        // Map Clerk role to our TenantRole
        let role: TenantRole = 'member';
        if (clerkMembership.role === 'org:admin' || clerkMembership.role === 'org:owner') {
          role = 'admin';
        } else if (clerkMembership.role === 'org:member') {
          role = 'member';
        } else if (clerkMembership.role === 'org:billing_admin') {
          role = 'billing_admin';
        }

        await prisma.tenantMembership.upsert({
          where: {
            tenantId_userId: {
              tenantId: tenant.id,
              userId: user.id,
            },
          },
          create: {
            clerkMembershipId: clerkMembership.id,
            tenantId: tenant.id,
            userId: user.id,
            role,
            status: 'active',
          },
          update: {
            clerkMembershipId: clerkMembership.id,
            role,
            status: 'active',
          },
        });
      }
    }
  } catch (error) {
    appLogger.error('Failed to sync user organizations from Clerk', {
      error: error instanceof Error ? error.message : String(error),
      userId: user.id,
      clerkUserId: user.clerkUserId,
    });
    // Don't throw - continue even if sync fails
  }
}

// Get user's tenants with memberships
async function getUserTenants(userId: string, user?: User): Promise<Array<Tenant & { membership: TenantMembership }>> {
  // If user is provided, sync organizations from Clerk first
  if (user) {
    await syncUserOrganizationsFromClerk(user);
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      userId,
      status: 'active',
    },
    select: {
      id: true,
      clerkMembershipId: true,
      tenantId: true,
      userId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          clerkOrgId: true,
          isPersonal: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return memberships.map((m) => ({
    ...m.tenant,
    metadata: null,
    deletedAt: null,
    logoUrl: null,
    ownerUserId: '',
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
  })) as Array<Tenant & { membership: TenantMembership }>;
}

// Map Clerk org to tenant (lookup only - creation happens via webhook)
// NOTE: Tenant and membership creation is now handled via Clerk webhooks (clerk-webhooks.ts)
// If tenant doesn't exist, try to fetch from Clerk and create it (fallback for missing webhooks)
async function mapClerkOrgToTenant(clerkOrgId: string, user: User): Promise<Tenant | null> {
  if (!clerkOrgId) return null;

  let tenant = await prisma.tenant.findUnique({
    where: { clerkOrgId },
  });

  if (!tenant && clerkClient) {
    // Fallback: Fetch org from Clerk and create tenant if webhook missed it
    try {
      appLogger.info('Tenant not found for clerkOrgId, fetching from Clerk as fallback', {
        clerkOrgId,
        userId: user.id,
      });
      
      const org = await clerkClient.organizations.getOrganization({ organizationId: clerkOrgId });
      
      tenant = await prisma.tenant.create({
        data: {
          clerkOrgId,
          name: org.name,
          slug: org.slug || `org-${clerkOrgId.replace('org_', '')}`,
          logoUrl: org.imageUrl,
          isPersonal: false,
        },
      });
      
      // Also create membership for the user if they're a member
      try {
        const membershipList = await clerkClient.users.getOrganizationMembershipList({
          userId: user.clerkUserId,
        });
        
        const membership = membershipList.data.find(m => m.organization.id === clerkOrgId);
        if (membership) {
          // Map Clerk role to our TenantRole
          let role: TenantRole = 'member';
          if (membership.role === 'org:admin' || membership.role === 'org:owner') {
            role = 'admin';
          } else if (membership.role === 'org:member') {
            role = 'member';
          } else if (membership.role === 'org:billing_admin') {
            role = 'billing_admin';
          }
          
          await prisma.tenantMembership.upsert({
            where: {
              tenantId_userId: {
                tenantId: tenant.id,
                userId: user.id,
              },
            },
            create: {
              clerkMembershipId: membership.id,
              tenantId: tenant.id,
              userId: user.id,
              role,
              status: 'active',
            },
            update: {
              clerkMembershipId: membership.id,
              role,
              status: 'active',
            },
          });
          
          appLogger.info('Membership created from Clerk as fallback', {
            tenantId: tenant.id,
            userId: user.id,
            role,
          });
        }
      } catch (membershipError) {
        appLogger.warn('Failed to create membership from Clerk as fallback', {
          error: membershipError instanceof Error ? membershipError.message : String(membershipError),
          clerkOrgId,
          userId: user.id,
        });
        // Continue even if membership creation fails
      }
      
      appLogger.info('Tenant created from Clerk as fallback', {
        tenantId: tenant.id,
        clerkOrgId,
        name: tenant.name,
      });
    } catch (error) {
      appLogger.error('Failed to fetch org from Clerk as fallback', {
        error: error instanceof Error ? error.message : String(error),
        clerkOrgId,
      });
      return null;
    }
  } else if (!tenant) {
    // Tenant should be created via webhook - log warning if not found
    appLogger.warn('Tenant not found for clerkOrgId (should be created via webhook)', {
      clerkOrgId,
    });
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

    // DEBUG: Try to decode token without verification to see what's in it
    if (env.NODE_ENV === 'development') {
      try {
        // JWT has format: header.payload.signature
        const parts = token.split('.');
        if (parts.length === 3) {
          // Decode base64url header and payload (without verification)
          const header = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
          const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
          
          appLogger.info('DEBUG: Token decoded (without verification)', {
            header,
            payload: {
              sub: payload.sub,
              azp: payload.azp || null,
              org_id: payload.org_id || null,
              exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
              iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
              iss: payload.iss || null,
            },
            isExpired: payload.exp ? payload.exp * 1000 < Date.now() : false,
          });
        } else {
          appLogger.warn('DEBUG: Token does not have 3 parts', { partsCount: parts.length });
        }
      } catch (decodeError) {
        appLogger.warn('DEBUG: Failed to decode token (without verification)', {
          error: decodeError instanceof Error ? decodeError.message : String(decodeError),
        });
      }
    }

    // In development without Clerk, allow mock auth
    if (!env.CLERK_SECRET_KEY && env.NODE_ENV === 'development') {
      appLogger.warn('Using mock authentication - Clerk not configured', {
        context: 'auth-middleware',
        nodeEnv: env.NODE_ENV,
      });
      
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

        // Set @gkeferstein/tenant compatible context
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

    // DEBUG: Log token verification attempt
    if (env.NODE_ENV === 'development') {
      appLogger.info('DEBUG: Attempting token verification', {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 50),
        hasSecretKey: !!env.CLERK_SECRET_KEY,
        secretKeyPrefix: env.CLERK_SECRET_KEY.substring(0, 20),
        secretKeyLength: env.CLERK_SECRET_KEY.length,
        secretKeyValid: env.CLERK_SECRET_KEY.startsWith('sk_test_') || env.CLERK_SECRET_KEY.startsWith('sk_live_'),
      });
    }

    let payload;
    try {
      // TEMPORARY: In development, try without authorizedParties first
      // This helps diagnose if authorizedParties is the issue
      // TODO: Re-enable authorizedParties once we know the correct azp value from the token
      const verifyOptions: any = {
        secretKey: env.CLERK_SECRET_KEY,
      };
      
      // Only add authorizedParties in production or if explicitly configured
      // In development, we'll try without it first to see if that's the issue
      if (env.NODE_ENV === 'production') {
        const authorizedParties = [
          env.FRONTEND_URL,
          'https://account.mojo-institut.de',
          'https://account.staging.mojo-institut.de',
        ].filter(Boolean);
        
        if (authorizedParties.length > 0) {
          verifyOptions.authorizedParties = authorizedParties;
        }
      }
      
      if (env.NODE_ENV === 'development') {
        appLogger.info('DEBUG: verifyToken options (development - no authorizedParties)', {
          hasAuthorizedParties: !!verifyOptions.authorizedParties,
        });
      }
      
      payload = await verifyToken(token, verifyOptions);
      
      if (env.NODE_ENV === 'development') {
        appLogger.info('DEBUG: Token verified successfully', {
          sub: payload.sub,
          org_id: (payload as any).org_id || null,
          azp: (payload as any).azp || null,
        });
      }
    } catch (verifyError) {
      const errorMessage = verifyError instanceof Error ? verifyError.message : String(verifyError);
      const errorStack = verifyError instanceof Error ? verifyError.stack : undefined;
      
      appLogger.error('DEBUG: Token verification failed', {
        error: errorMessage,
        errorName: verifyError instanceof Error ? verifyError.name : 'Unknown',
        stack: errorStack,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 50),
        tokenSuffix: token.substring(token.length - 20),
        hasSecretKey: !!env.CLERK_SECRET_KEY,
        secretKeyLength: env.CLERK_SECRET_KEY.length,
      });
      
      // Log the full error for debugging
      console.error('[AUTH] Full verification error:', {
        message: errorMessage,
        name: verifyError instanceof Error ? verifyError.name : 'Unknown',
        stack: errorStack,
      });
      
      throw verifyError; // Re-throw to hit the outer catch
    }

    const clerkUserId = payload.sub;
    const clerkOrgId = (payload as { org_id?: string }).org_id || null;
    const email = (payload as { email?: string }).email || '';
    const firstName = (payload as { first_name?: string }).first_name || null;
    const lastName = (payload as { last_name?: string }).last_name || null;
    const avatarUrl = (payload as { image_url?: string }).image_url || null;

    // Get or create user
    const user = await getOrCreateUser(clerkUserId, email, firstName, lastName, avatarUrl);

    // Get user's tenants (this will also sync organizations from Clerk)
    const tenants = await getUserTenants(user.id, user);

    // Map Clerk org to tenant if present
    let activeTenant: Tenant | null = null;
    let activeMembership: TenantMembership | null = null;
    let tenantSource: 'jwt_org_id' | 'header' | 'default' = 'default';

    // Priority 1: Use org_id from JWT if present
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
        tenantSource = 'jwt_org_id';
      }
    }

    // Priority 2: Use X-Active-Tenant-Id header if no org_id in JWT
    // This is a fallback for when Clerk's JWT cache hasn't updated yet
    const headerTenantId = request.headers['x-active-tenant-id'] as string | undefined;
    if (!activeTenant && headerTenantId) {
      const requestedTenant = tenants.find((t) => t.id === headerTenantId);
      if (requestedTenant) {
        activeTenant = requestedTenant;
        activeMembership = requestedTenant.membership;
        tenantSource = 'header';
        
        appLogger.info('Using tenant from X-Active-Tenant-Id header (JWT org_id missing)', {
          headerTenantId, 
          tenantName: requestedTenant.name,
          userId: user.id,
        });
      }
    }

    // Priority 3: Fall back to personal tenant
    if (!activeTenant) {
      const personalTenant = tenants.find((t) => t.isPersonal);
      if (personalTenant) {
        activeTenant = personalTenant;
        activeMembership = personalTenant.membership;
        tenantSource = 'default';
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

    // Set @gkeferstein/tenant compatible context
    request.tenantContext = activeTenant ? {
      tenant: toMojoTenant(activeTenant),
      source: tenantSource,
      rawIdentifier: clerkOrgId || headerTenantId || undefined,
    } : null;

  } catch (error) {
    appLogger.error('Auth error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      hasAuthHeader: !!request.headers.authorization,
      authHeaderPrefix: request.headers.authorization?.substring(0, 20) || 'none'
    });
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
 * Uses the standardized @gkeferstein/tenant header format
 */
export function createServiceHeaders(tenant: Tenant): Record<string, string> {
  return createTenantHeaders(toMojoTenant(tenant), 'accounts.mojo');
}

export default authMiddleware;
