import { FastifyInstance } from 'fastify';
import type { Session, SessionTenant } from '@accounts/shared';
import { createHash } from 'crypto';

// Generate ETag from session data
function generateETag(session: Session): string {
  const data = JSON.stringify(session);
  return createHash('md5').update(data).digest('hex');
}

export async function meRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /me - Get current user session info
  fastify.get('/me', async (request, reply) => {
    const { auth } = request;

    const sessionTenants: SessionTenant[] = auth.tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      role: t.membership.role,
      isPersonal: t.isPersonal,
      clerkOrgId: t.clerkOrgId,
    }));

    // Check for X-Active-Tenant-Id header to override active tenant
    // This is used when the JWT doesn't contain org_id (e.g., after switching tenants)
    const headerTenantId = request.headers['x-active-tenant-id'] as string | undefined;
    
    let activeTenant = auth.activeTenant;
    let activeMembership = auth.activeMembership;

    // If header provides a tenant ID, use that instead (if user has access)
    if (headerTenantId && headerTenantId !== auth.activeTenant?.id) {
      const requestedTenant = auth.tenants.find((t) => t.id === headerTenantId);
      if (requestedTenant) {
        activeTenant = requestedTenant;
        activeMembership = requestedTenant.membership;
        
        request.log.info({ 
          headerTenantId, 
          tenantName: requestedTenant.name,
          jwtOrgId: auth.clerkOrgId,
        }, 'Using tenant from X-Active-Tenant-Id header');
      }
    }

    const session: Session = {
      user: {
        id: auth.user.id,
        clerkUserId: auth.clerkUserId,
        email: auth.user.email,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
        avatarUrl: auth.user.avatarUrl,
      },
      tenants: sessionTenants,
      activeTenantId: activeTenant?.id || null,
      activeTenant: activeTenant
        ? {
            id: activeTenant.id,
            name: activeTenant.name,
            slug: activeTenant.slug,
            role: activeMembership?.role || 'member',
            isPersonal: activeTenant.isPersonal,
            clerkOrgId: activeTenant.clerkOrgId,
          }
        : null,
    };

    // ETag-based caching
    const etag = generateETag(session);
    const ifNoneMatch = request.headers['if-none-match'];

    if (ifNoneMatch === `"${etag}"`) {
      return reply.status(304).send(); // Not Modified
    }

    reply.header('ETag', `"${etag}"`);
    reply.header('Cache-Control', 'private, max-age=60'); // 1 Minute Cache
    return reply.send(session);
  });

  // POST /tenants/switch - Switch active tenant
  fastify.post<{ Body: { tenantId: string } }>('/tenants/switch', async (request, reply) => {
    const { auth } = request;
    const { tenantId } = request.body;

    // Verify user has access to this tenant
    const targetTenant = auth.tenants.find((t) => t.id === tenantId);

    if (!targetTenant) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this tenant',
      });
    }

    // In a real implementation, this might update a session cookie or similar
    // For now, we just return the new active tenant
    return reply.send({
      success: true,
      activeTenant: {
        id: targetTenant.id,
        name: targetTenant.name,
        slug: targetTenant.slug,
        role: targetTenant.membership.role,
        isPersonal: targetTenant.isPersonal,
      },
    });
  });
}

export default meRoutes;








