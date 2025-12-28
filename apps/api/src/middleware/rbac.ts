import { FastifyRequest, FastifyReply } from 'fastify';
import { TenantRole } from '@prisma/client';
import { ROLE_HIERARCHY, hasPermission, canManageRole } from '@accounts/shared';
import prisma from '../lib/prisma.js';

// RBAC middleware factory
export function requireRole(...allowedRoles: TenantRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { auth } = request;

    if (!auth?.activeMembership) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'No active tenant membership',
      });
    }

    const userRole = auth.activeMembership.role;
    const hasAllowedRole = allowedRoles.some((role) => hasPermission(userRole, role));

    if (!hasAllowedRole) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Required role: ${allowedRoles.join(' or ')}`,
      });
    }
  };
}

// Check if user can access a specific tenant
export function requireTenantAccess() {
  return async function (request: FastifyRequest<{ Params: { tenantId: string } }>, reply: FastifyReply): Promise<void> {
    const { auth } = request;
    const { tenantId } = request.params;

    if (!auth) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasTenantAccess = auth.tenants.some((t) => t.id === tenantId);

    if (!hasTenantAccess) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this tenant',
      });
    }

    // Set the requested tenant as active for this request
    const tenant = auth.tenants.find((t) => t.id === tenantId);
    if (tenant) {
      request.auth.activeTenant = tenant;
      request.auth.activeMembership = tenant.membership;
    }
  };
}

// Check if user can manage members in a tenant
export function requireMemberManagement() {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { auth } = request;

    if (!auth?.activeMembership) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'No active tenant membership',
      });
    }

    const userRole = auth.activeMembership.role;
    
    // Only owners and admins can manage members
    if (!hasPermission(userRole, 'admin')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only owners and admins can manage members',
      });
    }
  };
}

// Check if user can change a specific member's role
export async function canChangeRole(
  request: FastifyRequest,
  targetMemberId: string,
  newRole: TenantRole
): Promise<{ allowed: boolean; reason?: string }> {
  const { auth } = request;

  if (!auth?.activeMembership || !auth?.activeTenant) {
    return { allowed: false, reason: 'No active tenant membership' };
  }

  const userRole = auth.activeMembership.role;

  // Get target membership
  const targetMembership = await prisma.tenantMembership.findUnique({
    where: { id: targetMemberId },
    include: { user: true },
  });

  if (!targetMembership) {
    return { allowed: false, reason: 'Member not found' };
  }

  if (targetMembership.tenantId !== auth.activeTenant.id) {
    return { allowed: false, reason: 'Member not in this tenant' };
  }

  // Cannot change own role
  if (targetMembership.userId === auth.userId) {
    return { allowed: false, reason: 'Cannot change your own role' };
  }

  // Cannot change owner's role
  if (targetMembership.role === 'owner') {
    return { allowed: false, reason: 'Cannot change owner role' };
  }

  // Cannot assign owner role
  if (newRole === 'owner') {
    return { allowed: false, reason: 'Cannot assign owner role' };
  }

  // Check if user can manage target's current role
  if (!canManageRole(userRole, targetMembership.role)) {
    return { allowed: false, reason: 'Cannot manage this member' };
  }

  // Check if user can assign the new role
  if (!canManageRole(userRole, newRole)) {
    return { allowed: false, reason: 'Cannot assign this role' };
  }

  return { allowed: true };
}

// Check if user can remove a member
export async function canRemoveMember(
  request: FastifyRequest,
  targetMemberId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { auth } = request;

  if (!auth?.activeMembership || !auth?.activeTenant) {
    return { allowed: false, reason: 'No active tenant membership' };
  }

  const userRole = auth.activeMembership.role;

  // Get target membership
  const targetMembership = await prisma.tenantMembership.findUnique({
    where: { id: targetMemberId },
  });

  if (!targetMembership) {
    return { allowed: false, reason: 'Member not found' };
  }

  if (targetMembership.tenantId !== auth.activeTenant.id) {
    return { allowed: false, reason: 'Member not in this tenant' };
  }

  // Cannot remove self (use leave tenant instead)
  if (targetMembership.userId === auth.userId) {
    return { allowed: false, reason: 'Cannot remove yourself' };
  }

  // Cannot remove owner
  if (targetMembership.role === 'owner') {
    return { allowed: false, reason: 'Cannot remove owner' };
  }

  // Check if user can manage target's role
  if (!canManageRole(userRole, targetMembership.role)) {
    return { allowed: false, reason: 'Cannot manage this member' };
  }

  return { allowed: true };
}

export default {
  requireRole,
  requireTenantAccess,
  requireMemberManagement,
  canChangeRole,
  canRemoveMember,
};


