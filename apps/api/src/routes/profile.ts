import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import crmClient from '../clients/crm.js';
import { logAuditEvent, AuditActions } from '../services/audit.js';
import { profileUpdateSchema, consentsUpdateSchema } from '@accounts/shared';
import { isCacheStale, updateProfileCache, CACHE_TTL } from '../services/cache.service.js';

export async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /profile - Get user profile (aggregated from CRM/SSOT + local cache)
  fastify.get('/profile', async (request, reply) => {
    const { auth } = request;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

    // Try to get from cache first
    let profileCache = await prisma.profileCache.findUnique({
      where: {
        tenantId_userId: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
        },
      },
    });

    // If cache is stale (older than 5 minutes), refresh from CRM (SSOT)
    if (!profileCache || isCacheStale(profileCache, CACHE_TTL.PROFILE)) {
      // Fetch from kontakte.mojo (SSOT) using clerkUserId
      // Use fallback: if fetch fails, use stale cache if available
      try {
        const crmProfile = await crmClient.getProfile(auth.clerkUserId);

        if (crmProfile) {
          profileCache = await updateProfileCache(
            auth.activeTenant.id,
            auth.userId,
            crmProfile
          );
        }
      } catch (error) {
        // Fallback: Use stale cache if available, otherwise continue with default
        request.log.warn({
          err: error,
          message: 'Failed to refresh profile from CRM, using cache if available',
          userId: auth.userId,
          hasStaleCache: !!profileCache,
        });
        
        // If we don't have any cache, we'll fall through to default values
        if (!profileCache) {
          // No cache available, will use defaults below
        }
        // If we have stale cache, we'll use it (already set above)
      }
    }

    const profile = profileCache?.payload || {
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
      email: auth.user.email,
      phone: null,
      company: null,
      street: null,
      city: null,
      postalCode: null,
      country: null,
      vatId: null,
    };

    await logAuditEvent(request, {
      action: AuditActions.PROFILE_VIEW,
    });

    return reply.send(profile);
  });

  // PATCH /profile - Update user profile (writes to SSOT kontakte.mojo)
  fastify.patch('/profile', async (request, reply) => {
    const { auth } = request;
    const input = profileUpdateSchema.parse(request.body);

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

    // Update in CRM (SSOT) using clerkUserId
    const updatedProfile = await crmClient.updateProfile(auth.clerkUserId, input);

    if (!updatedProfile) {
      return reply.status(500).send({
        error: 'Server Error',
        message: 'Failed to update profile in CRM',
      });
    }

    // Update local cache
    await prisma.profileCache.upsert({
      where: {
        tenantId_userId: {
          tenantId: auth.activeTenant.id,
          userId: auth.userId,
        },
      },
      create: {
        tenantId: auth.activeTenant.id,
        userId: auth.userId,
        payload: updatedProfile as any,
      },
      update: {
        payload: updatedProfile as any,
      },
    });

    // Also update local user record for first/last name
    if (input.firstName !== undefined || input.lastName !== undefined) {
      await prisma.user.update({
        where: { id: auth.userId },
        data: {
          ...(input.firstName !== undefined && { firstName: input.firstName }),
          ...(input.lastName !== undefined && { lastName: input.lastName }),
        },
      });
    }

    await logAuditEvent(request, {
      action: AuditActions.PROFILE_UPDATE,
      metadata: { fields: Object.keys(input) },
    });

    return reply.send(updatedProfile);
  });

  // GET /profile/consents - Get user consents (from SSOT kontakte.mojo)
  fastify.get('/profile/consents', async (request, reply) => {
    const { auth } = request;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

    // Fetch from kontakte.mojo (SSOT) using clerkUserId
    const consents = await crmClient.getConsents(auth.clerkUserId);

    return reply.send({ consents });
  });

  // PATCH /profile/consents - Update user consents (writes to SSOT kontakte.mojo)
  fastify.patch('/profile/consents', async (request, reply) => {
    const { auth } = request;
    const input = consentsUpdateSchema.parse(request.body);

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

    // Update in kontakte.mojo (SSOT) using clerkUserId
    const updatedConsents = await crmClient.updateConsents(auth.clerkUserId, input.consents);

    await logAuditEvent(request, {
      action: AuditActions.PREFERENCES_UPDATE,
      metadata: { type: 'consents', changes: input.consents },
    });

    return reply.send({ consents: updatedConsents });
  });
}

export default profileRoutes;


