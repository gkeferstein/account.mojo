import { FastifyRequest } from 'fastify';
import prisma from '../lib/prisma.js';

export interface AuditLogParams {
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(
  request: FastifyRequest,
  params: AuditLogParams
): Promise<void> {
  const { auth } = request;

  if (!auth?.userId || !auth?.activeTenant) {
    console.warn('Cannot log audit event: missing auth context');
    return;
  }

  try {
    await prisma.auditLog.create({
      data: {
        tenantId: auth.activeTenant.id,
        userId: auth.userId,
        action: params.action,
        resourceType: params.resourceType || null,
        resourceId: params.resourceId || null,
        ip: request.ip || null,
        userAgent: request.headers['user-agent'] || null,
        metadata: params.metadata || null,
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging should not break the request
  }
}

// Pre-defined audit actions
export const AuditActions = {
  // Profile
  PROFILE_VIEW: 'profile.view',
  PROFILE_UPDATE: 'profile.update',
  
  // Tenant
  TENANT_CREATE: 'tenant.create',
  TENANT_UPDATE: 'tenant.update',
  TENANT_DELETE: 'tenant.delete',
  TENANT_SWITCH: 'tenant.switch',
  
  // Membership
  MEMBER_INVITE: 'member.invite',
  MEMBER_ROLE_CHANGE: 'member.role_change',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_JOIN: 'member.join',
  
  // Billing
  BILLING_VIEW: 'billing.view',
  BILLING_PORTAL_ACCESS: 'billing.portal_access',
  
  // Preferences
  PREFERENCES_UPDATE: 'preferences.update',
  
  // Data
  DATA_EXPORT_REQUEST: 'data.export_request',
  DATA_DELETE_REQUEST: 'data.delete_request',
  
  // Security
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGE: 'auth.password_change',
  TWO_FACTOR_ENABLE: 'auth.2fa_enable',
  TWO_FACTOR_DISABLE: 'auth.2fa_disable',
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

export default {
  logAuditEvent,
  AuditActions,
};


