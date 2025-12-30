import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: 'up' | 'down';
  };
}

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // Simple health check
  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Detailed health check
  fastify.get('/health/detailed', async (_request, reply) => {
    const response: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      services: {
        database: 'down',
      },
    };

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      response.services.database = 'up';
    } catch (error) {
      response.services.database = 'down';
      response.status = 'degraded';
    }

    // Set status based on services
    if (response.services.database === 'down') {
      response.status = 'unhealthy';
      return reply.status(503).send(response);
    }

    return reply.send(response);
  });

  // Readiness probe (for Kubernetes/Docker)
  fastify.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ ready: true });
    } catch (error) {
      return reply.status(503).send({ ready: false, error: 'Database not ready' });
    }
  });

  // Liveness probe
  fastify.get('/live', async (_request, reply) => {
    return reply.send({ live: true });
  });
}

export default healthRoutes;







