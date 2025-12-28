import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { requireRole, requireTenantAccess, requireMemberManagement, canChangeRole, canRemoveMember } from '../middleware/rbac.js';
import { logAuditEvent, AuditActions } from '../services/audit.js';
import { generateSlug, generateInviteToken, createTenantSchema, updateTenantSchema, inviteMemberSchema, updateMemberRoleSchema } from '@accounts/shared';
import { TenantRole } from '@prisma/client';

export async function tenantsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /tenants - List user's tenants
  fastify.get('/tenants', async (request, reply) => {
    const { auth } = request;

    const tenants = auth.tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      logoUrl: t.logoUrl,
      isPersonal: t.isPersonal,
      role: t.membership.role,
      memberCount: 0, // Would need to fetch this
      createdAt: t.createdAt,
    }));

    return reply.send({ tenants });
  });

  // POST /tenants - Create new tenant (organization)
  fastify.post('/tenants', async (request, reply) => {
    const { auth } = request;
    const input = createTenantSchema.parse(request.body);

    const slug = input.slug || generateSlug(input.name);

    // Check if slug is taken
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'A tenant with this slug already exists',
      });
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: input.name,
        slug,
        isPersonal: false,
      },
    });

    // Create owner membership for creator
    await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: auth.userId,
        role: 'owner',
        status: 'active',
      },
    });

    // Create default preferences
    await prisma.preferences.create({
      data: {
        tenantId: tenant.id,
        userId: auth.userId,
      },
    });

    await logAuditEvent(request, {
      action: AuditActions.TENANT_CREATE,
      resourceType: 'tenant',
      resourceId: tenant.id,
      metadata: { name: tenant.name, slug: tenant.slug },
    });

    return reply.status(201).send({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      isPersonal: tenant.isPersonal,
      role: 'owner',
    });
  });

  // GET /tenants/:tenantId - Get tenant details
  fastify.get<{ Params: { tenantId: string } }>(
    '/tenants/:tenantId',
    { preHandler: [requireTenantAccess()] },
    async (request, reply) => {
      const { tenantId } = request.params;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          memberships: {
            where: { status: 'active' },
            include: { user: true },
          },
          invitations: {
            where: { status: 'pending' },
          },
          _count: {
            select: { memberships: { where: { status: 'active' } } },
          },
        },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
      }

      return reply.send({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        isPersonal: tenant.isPersonal,
        createdAt: tenant.createdAt,
        memberCount: tenant._count.memberships,
        members: tenant.memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.createdAt,
        })),
        pendingInvitations: tenant.invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
        })),
      });
    }
  );

  // PATCH /tenants/:tenantId - Update tenant
  fastify.patch<{ Params: { tenantId: string } }>(
    '/tenants/:tenantId',
    { preHandler: [requireTenantAccess(), requireRole('admin', 'owner')] },
    async (request, reply) => {
      const { tenantId } = request.params;
      const input = updateTenantSchema.parse(request.body);

      // Check slug uniqueness if changing
      if (input.slug) {
        const existing = await prisma.tenant.findFirst({
          where: { slug: input.slug, id: { not: tenantId } },
        });
        if (existing) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'A tenant with this slug already exists',
          });
        }
      }

      const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: input,
      });

      await logAuditEvent(request, {
        action: AuditActions.TENANT_UPDATE,
        resourceType: 'tenant',
        resourceId: tenant.id,
        metadata: { changes: input },
      });

      return reply.send({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        isPersonal: tenant.isPersonal,
      });
    }
  );

  // POST /tenants/:tenantId/invite - Invite member
  fastify.post<{ Params: { tenantId: string } }>(
    '/tenants/:tenantId/invite',
    { preHandler: [requireTenantAccess(), requireMemberManagement()] },
    async (request, reply) => {
      const { tenantId } = request.params;
      const input = inviteMemberSchema.parse(request.body);

      // Check if user already a member
      const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
      if (existingUser) {
        const existingMembership = await prisma.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId, userId: existingUser.id } },
        });
        if (existingMembership && existingMembership.status === 'active') {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'User is already a member of this tenant',
          });
        }
      }

      // Check if invitation already pending
      const existingInvitation = await prisma.tenantInvitation.findFirst({
        where: { tenantId, email: input.email, status: 'pending' },
      });
      if (existingInvitation) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'An invitation is already pending for this email',
        });
      }

      // Create invitation
      const invitation = await prisma.tenantInvitation.create({
        data: {
          tenantId,
          email: input.email,
          role: input.role as TenantRole,
          token: generateInviteToken(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      await logAuditEvent(request, {
        action: AuditActions.MEMBER_INVITE,
        resourceType: 'invitation',
        resourceId: invitation.id,
        metadata: { email: input.email, role: input.role },
      });

      // TODO: Send invitation email via email provider

      return reply.status(201).send({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviteUrl: `${process.env.FRONTEND_URL}/invite?token=${invitation.token}`,
      });
    }
  );

  // POST /tenants/:tenantId/members/:memberId/role - Change member role
  fastify.post<{ Params: { tenantId: string; memberId: string } }>(
    '/tenants/:tenantId/members/:memberId/role',
    { preHandler: [requireTenantAccess(), requireMemberManagement()] },
    async (request, reply) => {
      const { memberId } = request.params;
      const input = updateMemberRoleSchema.parse(request.body);

      const check = await canChangeRole(request, memberId, input.role as TenantRole);
      if (!check.allowed) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: check.reason,
        });
      }

      const membership = await prisma.tenantMembership.update({
        where: { id: memberId },
        data: { role: input.role as TenantRole },
        include: { user: true },
      });

      await logAuditEvent(request, {
        action: AuditActions.MEMBER_ROLE_CHANGE,
        resourceType: 'membership',
        resourceId: memberId,
        metadata: { newRole: input.role, userId: membership.userId },
      });

      return reply.send({
        id: membership.id,
        userId: membership.userId,
        email: membership.user.email,
        role: membership.role,
      });
    }
  );

  // DELETE /tenants/:tenantId/members/:memberId - Remove member
  fastify.delete<{ Params: { tenantId: string; memberId: string } }>(
    '/tenants/:tenantId/members/:memberId',
    { preHandler: [requireTenantAccess(), requireMemberManagement()] },
    async (request, reply) => {
      const { memberId } = request.params;

      const check = await canRemoveMember(request, memberId);
      if (!check.allowed) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: check.reason,
        });
      }

      const membership = await prisma.tenantMembership.update({
        where: { id: memberId },
        data: { status: 'removed' },
      });

      await logAuditEvent(request, {
        action: AuditActions.MEMBER_REMOVE,
        resourceType: 'membership',
        resourceId: memberId,
        metadata: { userId: membership.userId },
      });

      return reply.send({ success: true });
    }
  );

  // DELETE /tenants/:tenantId/invitations/:invitationId - Revoke invitation
  fastify.delete<{ Params: { tenantId: string; invitationId: string } }>(
    '/tenants/:tenantId/invitations/:invitationId',
    { preHandler: [requireTenantAccess(), requireMemberManagement()] },
    async (request, reply) => {
      const { tenantId, invitationId } = request.params;

      const invitation = await prisma.tenantInvitation.findFirst({
        where: { id: invitationId, tenantId, status: 'pending' },
      });

      if (!invitation) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Invitation not found',
        });
      }

      await prisma.tenantInvitation.update({
        where: { id: invitationId },
        data: { status: 'revoked' },
      });

      return reply.send({ success: true });
    }
  );
}

export default tenantsRoutes;

