import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import env, { validateEnv } from './lib/env.js';
import prisma from './lib/prisma.js';
import { registerAuthPlugin, authMiddleware } from './middleware/auth.js';
import errorHandler from './middleware/error-handler.js';
import { appLogger } from './lib/logger.js';
import healthRoutes from './routes/health.js';
import meRoutes from './routes/me.js';
import tenantsRoutes from './routes/tenants.js';
import profileRoutes from './routes/profile.js';
import preferencesRoutes from './routes/preferences.js';
import billingRoutes from './routes/billing.js';
import entitlementsRoutes from './routes/entitlements.js';
import dataRoutes from './routes/data.js';
import webhooksRoutes from './routes/webhooks.js';
import clerkWebhooksRoutes from './routes/clerk-webhooks.js';
import internalRoutes from './routes/internal.js';

// Validate environment variables
try {
  validateEnv();
} catch (error) {
  // Use appLogger for startup errors (console.error is acceptable for startup failures)
  appLogger.error('Environment validation failed', { 
    error: error instanceof Error ? error.message : String(error) 
  });
  process.exit(1);
}

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    transport: env.NODE_ENV === 'development' 
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// Register plugins
async function registerPlugins(): Promise<void> {
  // CORS - environment-based configuration
  const corsOrigins = [env.FRONTEND_URL];
  // Only allow localhost in development
  if (env.NODE_ENV === 'development') {
    corsOrigins.push('http://localhost:3000');
  }
  
  await fastify.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Auth plugin
  registerAuthPlugin(fastify);
}

// Register routes
async function registerRoutes(): Promise<void> {
  // Public routes (no auth required)
  await fastify.register(healthRoutes, { prefix: '/api/v1' });
  
  // Webhook routes (special auth - signature verification)
  await fastify.register(webhooksRoutes, { prefix: '/api/v1/webhooks' });
  
  // Clerk Webhook route (Svix signature verification)
  await fastify.register(clerkWebhooksRoutes, { prefix: '/api/v1/webhooks' });
  
  // Internal API routes (service-to-service, token auth)
  await fastify.register(internalRoutes, { prefix: '/api/internal' });

  // Protected routes (auth required)
  await fastify.register(async (protectedRoutes) => {
    // Add auth middleware to all routes in this scope
    protectedRoutes.addHook('preHandler', authMiddleware);

    await protectedRoutes.register(meRoutes);
    await protectedRoutes.register(tenantsRoutes);
    await protectedRoutes.register(profileRoutes);
    await protectedRoutes.register(preferencesRoutes);
    await protectedRoutes.register(billingRoutes);
    await protectedRoutes.register(entitlementsRoutes);
    await protectedRoutes.register(dataRoutes);
  }, { prefix: '/api/v1' });
}

// Error handler
fastify.setErrorHandler(errorHandler);

// Graceful shutdown
async function gracefulShutdown(): Promise<void> {
  console.log('Shutting down gracefully...');
  
  await fastify.close();
  await prisma.$disconnect();
  
  console.log('Server shut down successfully');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function start(): Promise<void> {
  try {
    await registerPlugins();
    await registerRoutes();

    // Connect to database
    await prisma.$connect();
    console.log('✅ Database connected');

    // Start server
    await fastify.listen({ port: env.PORT, host: env.HOST });
    
    console.log(`🚀 accounts.mojo API running on ${env.HOST}:${env.PORT}`);
    console.log(`📡 Health check: http://localhost:${env.PORT}/api/v1/health`);
    console.log(`🌐 Mode: ${env.NODE_ENV}`);
    console.log(`🔧 Mock services: ${env.MOCK_EXTERNAL_SERVICES}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// CI trigger
// CI complete run
// Final CI run
// CI complete run check
// Final CI run with critical tests
