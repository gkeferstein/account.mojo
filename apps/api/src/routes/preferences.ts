import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { logAuditEvent, AuditActions } from '../services/audit.js';
import { preferencesUpdateSchema, type Preferences } from '@accounts/shared';
import { requireActiveTenant } from '../middleware/active-tenant.js';

const DEFAULT_PREFERENCES: Preferences = {
  newsletter: false,
  productUpdates: true,
  marketingEmails: false,
  emailNotifications: true,
  pushNotifications: false,
  language: 'de',
  timezone: 'Europe/Berlin',
};

export async function preferencesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /preferences - Get user preferences
  fastify.get('/preferences', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
    const { auth } = request;

    const prefs = await prisma.preferences.findUnique({
      where: {
        tenantId_userId: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
        },
      },
    });

    const preferences = prefs?.payload 
      ? { ...DEFAULT_PREFERENCES, ...(prefs.payload as unknown as Preferences) }
      : DEFAULT_PREFERENCES;

    return reply.send(preferences);
  });

  // PATCH /preferences - Update user preferences
  fastify.patch('/preferences', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
    const { auth } = request;
    const input = preferencesUpdateSchema.parse(request.body);

    // Get current preferences
    const currentPrefs = await prisma.preferences.findUnique({
      where: {
        tenantId_userId: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
        },
      },
    });

    const currentPayload = currentPrefs?.payload as unknown as Preferences | null;
    const newPayload = {
      ...DEFAULT_PREFERENCES,
      ...currentPayload,
      ...input,
    };

    // Update preferences
    const prefs = await prisma.preferences.upsert({
      where: {
        tenantId_userId: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
        },
      },
      create: {
        tenantId: auth.activeTenant.id,
        userId: auth.userId,
        payload: newPayload,
      },
      update: {
        payload: newPayload,
      },
    });

    await logAuditEvent(request, {
      action: AuditActions.PREFERENCES_UPDATE,
      metadata: { changes: input },
    });

    return reply.send(prefs.payload);
  });
}

export default preferencesRoutes;








