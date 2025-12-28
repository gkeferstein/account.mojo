import { FastifyInstance } from 'fastify';
import type { Session, SessionTenant } from '@accounts/shared';

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
    }));

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
      activeTenantId: auth.activeTenant?.id || null,
      activeTenant: auth.activeTenant
        ? {
            id: auth.activeTenant.id,
            name: auth.activeTenant.name,
            slug: auth.activeTenant.slug,
            role: auth.activeMembership?.role || 'member',
            isPersonal: auth.activeTenant.isPersonal,
          }
        : null,
    };

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

