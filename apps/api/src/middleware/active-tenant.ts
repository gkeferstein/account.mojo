import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Middleware to require an active tenant
 * Returns 400 if no active tenant is set
 */
export function requireActiveTenant() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.auth?.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }
  };
}

