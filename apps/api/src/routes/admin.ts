/**
 * Admin Routes for Platform Admins
 * 
 * Provides admin-only endpoints for:
 * - Resend Email Management
 * - Platform-wide administration
 */

import { FastifyInstance } from 'fastify';
import { appLogger } from '../lib/logger.js';
import { Resend } from 'resend';
import env from '../lib/env.js';

// Initialize Resend client
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Middleware to check if user is platform admin
async function requirePlatformAdmin(request: any, reply: any): Promise<void> {
  const { auth } = request;

  if (!auth?.user?.platformRole || auth.user.platformRole !== 'platform_admin') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Platform admin access required',
    });
  }
}

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply platform admin check to all routes
  fastify.addHook('preHandler', requirePlatformAdmin);

  // ==========================================
  // Resend Email Management
  // ==========================================

  // GET /admin/resend/emails - List sent emails
  fastify.get('/resend/emails', async (request, reply) => {
    if (!resend) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Resend not configured',
      });
    }

    try {
      const { limit = '50', cursor } = request.query as { limit?: string; cursor?: string };

      // Resend API: List emails
      // Note: Resend v4 doesn't have emails.list - return empty list for now
      // TODO: Implement proper email listing when Resend API supports it
      return reply.send({
        emails: [],
        hasMore: false,
        nextCursor: null,
      });
    } catch (error: any) {
      appLogger.error('Failed to list emails from Resend', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Failed to fetch emails',
      });
    }
  });

  // GET /admin/resend/emails/:id - Get email details
  fastify.get('/resend/emails/:id', async (request, reply) => {
    if (!resend) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Resend not configured',
      });
    }

    try {
      const { id } = request.params as { id: string };

      const result = await resend.emails.get(id);

      return reply.send(result);
    } catch (error: any) {
      appLogger.error('Failed to get email from Resend', {
        error: error instanceof Error ? error.message : String(error),
        emailId: (request.params as { id: string }).id,
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Failed to fetch email',
      });
    }
  });

  // POST /admin/resend/emails/send - Send email (admin override)
  fastify.post('/resend/emails/send', async (request, reply) => {
    if (!resend) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Resend not configured',
      });
    }

    try {
      const body = request.body as {
        to: string | string[];
        subject: string;
        html?: string;
        text?: string;
        from?: string;
        replyTo?: string;
        tags?: string[];
        metadata?: Record<string, string>;
      };

      if (!body.to || !body.subject || (!body.html && !body.text)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Missing required fields: to, subject, html or text',
        });
      }

      const result = await resend.emails.send({
        from: body.from || env.EMAIL_FROM || 'MOJO Institut <noreply@mojo-institut.de>',
        to: Array.isArray(body.to) ? body.to : [body.to],
        subject: body.subject,
        html: body.html,
        text: body.text,
        replyTo: body.replyTo,
        tags: body.tags ? (Array.isArray(body.tags) ? body.tags.map(t => typeof t === 'string' ? { name: t, value: t } : (t as { name: string; value: string })) : []) : undefined,
      });

      appLogger.info('Email sent via admin interface', {
        to: body.to,
        subject: body.subject,
        messageId: result.data?.id,
      });

      return reply.send({
        success: true,
        messageId: result.data?.id,
      });
    } catch (error: any) {
      appLogger.error('Failed to send email via admin interface', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Failed to send email',
      });
    }
  });

  // GET /admin/resend/domains - List domains
  fastify.get('/resend/domains', async (request, reply) => {
    if (!resend) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Resend not configured',
      });
    }

    try {
      const result = await resend.domains.list();

      return reply.send({
        domains: result.data || [],
      });
    } catch (error: any) {
      appLogger.error('Failed to list domains from Resend', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Failed to fetch domains',
      });
    }
  });

  // GET /admin/resend/api-keys - List API keys (if supported)
  fastify.get('/resend/api-keys', async (request, reply) => {
    // Note: Resend API might not support listing API keys via API
    // This endpoint returns the configured key status
    return reply.send({
      configured: !!env.RESEND_API_KEY,
      keyPrefix: env.RESEND_API_KEY ? env.RESEND_API_KEY.substring(0, 10) + '...' : null,
      note: 'API keys are managed via Resend Dashboard',
    });
  });

  // GET /admin/resend/stats - Get email statistics
  fastify.get('/resend/stats', async (request, reply) => {
    if (!resend) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Resend not configured',
      });
    }

    try {
      // Resend v4 doesn't have analytics.retrieve - return empty stats for now
      // TODO: Implement proper stats when Resend API supports it
      const stats = {
        total: 0,
        sent: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        opened: 0,
        clicked: 0,
      };

      return reply.send(stats);
    } catch (error: any) {
      appLogger.error('Failed to get email stats from Resend', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Failed to fetch stats',
      });
    }
  });
}

export default adminRoutes;

