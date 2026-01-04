import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { requireRole, requireTenantAccess, requireMemberManagement, canChangeRole, canRemoveMember } from '../middleware/rbac.js';
import { logAuditEvent, AuditActions } from '../services/audit.js';
import { generateSlug, generateInviteToken, createTenantSchema, updateTenantSchema, inviteMemberSchema, updateMemberRoleSchema, paginationSchema } from '@accounts/shared';
import { TenantRole } from '@prisma/client';
import { appLogger } from '../lib/logger.js';
import env from '../lib/env.js';

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

    // Create tenant, membership, and preferences in a transaction for consistency
    // Rely on database unique constraint to prevent race conditions
    try {
      const tenant = await prisma.$transaction(async (tx) => {
        const newTenant = await tx.tenant.create({
          data: {
            name: input.name,
            slug,
            isPersonal: false,
          },
        });

        // Create owner membership for creator
        await tx.tenantMembership.create({
          data: {
            tenantId: newTenant.id,
            userId: auth.userId,
            role: 'owner',
            status: 'active',
          },
        });

        // Create default preferences
        await tx.preferences.create({
          data: {
            tenantId: newTenant.id,
            userId: auth.userId,
          },
        });

        return newTenant;
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
    } catch (error) {
      // Handle unique constraint violation (race condition)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Check if it's the slug field that caused the conflict
        if (error.meta && typeof error.meta === 'object' && 'target' in error.meta) {
          const target = error.meta.target as string[];
          if (target.includes('slug')) {
            return reply.status(409).send({
              error: 'Conflict',
              message: 'A tenant with this slug already exists',
            });
          }
        }
        // Generic conflict error
        return reply.status(409).send({
          error: 'Conflict',
          message: 'A tenant with this value already exists',
        });
      }
      // Re-throw other errors to be handled by error handler
      throw error;
    }
  });

  // GET /tenants/:tenantId - Get tenant details
  fastify.get<{ Params: { tenantId: string }; Querystring: { page?: string; pageSize?: string } }>(
    '/tenants/:tenantId',
    { preHandler: [requireTenantAccess()] },
    async (request, reply) => {
      const { tenantId } = request.params;
      const { page, pageSize } = paginationSchema.parse(request.query);

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          isPersonal: true,
          createdAt: true,
          memberships: {
            where: { status: 'active' },
            select: {
              id: true,
              userId: true,
              role: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
          },
          invitations: {
            where: { status: 'pending' },
            select: {
              id: true,
              email: true,
              role: true,
              expiresAt: true,
              createdAt: true,
            },
          },
          _count: {
            select: { memberships: { where: { status: 'active' } } },
          },
        },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
      }

      const totalMembers = tenant._count.memberships;
      const totalPages = Math.ceil(totalMembers / pageSize);

      return reply.send({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        isPersonal: tenant.isPersonal,
        createdAt: tenant.createdAt,
        memberCount: totalMembers,
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
        pagination: {
          page,
          pageSize,
          total: totalMembers,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
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

      // Update tenant - rely on database unique constraint to prevent race conditions
      try {
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
      } catch (error) {
        // Handle unique constraint violation (race condition)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          // Check if it's the slug field that caused the conflict
          if (error.meta && typeof error.meta === 'object' && 'target' in error.meta) {
            const target = error.meta.target as string[];
            if (target.includes('slug')) {
              return reply.status(409).send({
                error: 'Conflict',
                message: 'A tenant with this slug already exists',
              });
            }
          }
          // Generic conflict error
          return reply.status(409).send({
            error: 'Conflict',
            message: 'A tenant with this value already exists',
          });
        }
        // Re-throw other errors to be handled by error handler
        throw error;
      }

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

      // Get tenant and auth for email
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      const { auth } = request;

      // Send invitation email
      if (tenant && auth) {
        try {
          const { sendTenantInvitationEmail } = await import('../services/email.service.js');
          await sendTenantInvitationEmail({
            to: input.email,
            tenantName: tenant.name,
            inviterName: auth.user.firstName && auth.user.lastName
              ? `${auth.user.firstName} ${auth.user.lastName}`
              : auth.user.email,
            role: input.role,
            inviteUrl: `${env.FRONTEND_URL}/invite?token=${invitation.token}`,
            expiresAt: invitation.expiresAt,
          });
      } catch (error) {
        // Log error but don't fail the invitation creation
        appLogger.error('Failed to send invitation email', {
          error: error instanceof Error ? error.message : String(error),
          invitationId: invitation.id,
          email: input.email,
        });
      }

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








