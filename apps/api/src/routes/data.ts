import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { logAuditEvent, AuditActions } from '../services/audit.js';
import { createDataRequestSchema } from '@accounts/shared';

export async function dataRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /data/requests - List data requests
  fastify.get('/data/requests', async (request, reply) => {
    const { auth } = request;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

    const requests = await prisma.dataRequest.findMany({
      where: {
        tenantId: auth.activeTenant.id,
        userId: auth.userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return reply.send({
      requests: requests.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        downloadUrl: r.downloadUrl,
      })),
    });
  });

  // POST /data/export-request - Request data export
  fastify.post('/data/export-request', async (request, reply) => {
    const { auth } = request;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

    // Check for existing pending request
    const existingRequest = await prisma.dataRequest.findFirst({
      where: {
        tenantId: auth.activeTenant.id,
        userId: auth.userId,
        type: 'export',
        status: { in: ['pending', 'processing'] },
      },
    });

    if (existingRequest) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'You already have a pending export request',
        existingRequest: {
          id: existingRequest.id,
          status: existingRequest.status,
          createdAt: existingRequest.createdAt,
        },
      });
    }

    const dataRequest = await prisma.dataRequest.create({
      data: {
        tenantId: auth.activeTenant.id,
        userId: auth.userId,
        type: 'export',
        status: 'pending',
        metadata: {
          requestedAt: new Date().toISOString(),
          ip: request.ip,
        },
      },
    });

    await logAuditEvent(request, {
      action: AuditActions.DATA_EXPORT_REQUEST,
      resourceType: 'data_request',
      resourceId: dataRequest.id,
    });

    // TODO: Queue job to process export

    return reply.status(201).send({
      id: dataRequest.id,
      type: dataRequest.type,
      status: dataRequest.status,
      createdAt: dataRequest.createdAt,
      message: 'Your data export request has been received. You will be notified when it is ready for download.',
    });
  });

  // POST /data/delete-request - Request account deletion
  fastify.post('/data/delete-request', async (request, reply) => {
    const { auth } = request;
    const input = createDataRequestSchema.parse({ ...request.body, type: 'delete' });

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

    // Check for existing pending request
    const existingRequest = await prisma.dataRequest.findFirst({
      where: {
        tenantId: auth.activeTenant.id,
        userId: auth.userId,
        type: 'delete',
        status: { in: ['pending', 'processing'] },
      },
    });

    if (existingRequest) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'You already have a pending deletion request',
        existingRequest: {
          id: existingRequest.id,
          status: existingRequest.status,
          createdAt: existingRequest.createdAt,
        },
      });
    }

    const dataRequest = await prisma.dataRequest.create({
      data: {
        tenantId: auth.activeTenant.id,
        userId: auth.userId,
        type: 'delete',
        status: 'pending',
        reason: input.reason,
        metadata: {
          requestedAt: new Date().toISOString(),
          ip: request.ip,
          reason: input.reason,
        },
      },
    });

    await logAuditEvent(request, {
      action: AuditActions.DATA_DELETE_REQUEST,
      resourceType: 'data_request',
      resourceId: dataRequest.id,
      metadata: { reason: input.reason },
    });

    // TODO: Queue job to process deletion (with delay for review)

    return reply.status(201).send({
      id: dataRequest.id,
      type: dataRequest.type,
      status: dataRequest.status,
      createdAt: dataRequest.createdAt,
      message: 'Your account deletion request has been received. Your account will be deleted within 30 days unless cancelled.',
    });
  });

  // DELETE /data/requests/:requestId - Cancel data request
  fastify.delete<{ Params: { requestId: string } }>('/data/requests/:requestId', async (request, reply) => {
    const { auth } = request;
    const { requestId } = request.params;

    if (!auth.activeTenant) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No active tenant',
      });
    }

    const dataRequest = await prisma.dataRequest.findFirst({
      where: {
        id: requestId,
        tenantId: auth.activeTenant.id,
        userId: auth.userId,
      },
    });

    if (!dataRequest) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Request not found',
      });
    }

    if (dataRequest.status !== 'pending') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Only pending requests can be cancelled',
      });
    }

    await prisma.dataRequest.update({
      where: { id: requestId },
      data: { status: 'failed', metadata: { ...dataRequest.metadata as object, cancelledAt: new Date().toISOString() } },
    });

    return reply.send({ success: true, message: 'Request cancelled' });
  });
}

export default dataRoutes;


