import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const response: ErrorResponse = {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  };

  let statusCode = 500;

  // Zod validation errors
  if (error instanceof ZodError) {
    statusCode = 400;
    response.error = 'Validation Error';
    response.message = 'Invalid request data';
    response.details = {
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  // Prisma errors
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        statusCode = 409;
        response.error = 'Conflict';
        response.message = 'A record with this value already exists';
        response.code = error.code;
        break;
      case 'P2025':
        statusCode = 404;
        response.error = 'Not Found';
        response.message = 'The requested resource was not found';
        response.code = error.code;
        break;
      case 'P2003':
        statusCode = 400;
        response.error = 'Bad Request';
        response.message = 'Foreign key constraint failed';
        response.code = error.code;
        break;
      default:
        response.error = 'Database Error';
        response.message = 'A database error occurred';
        response.code = error.code;
    }
  }
  // Fastify errors
  else if (error.statusCode) {
    statusCode = error.statusCode;
    response.error = error.name || 'Error';
    response.message = error.message;
    if (error.code) {
      response.code = error.code;
    }
  }
  // Generic errors
  else if (error.message) {
    response.message = error.message;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  // Log error
  request.log.error({
    err: error,
    request: {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
    },
  });

  reply.status(statusCode).send(response);
}

export default errorHandler;

