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

const isDevelopment = process.env.NODE_ENV === 'development';

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
  else if (error && typeof error === 'object' && 'code' in error && 'meta' in error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    switch (prismaError.code) {
      case 'P2002':
        statusCode = 409;
        response.error = 'Conflict';
        response.message = 'A record with this value already exists';
        // Only include Prisma error code in development
        if (isDevelopment) {
          response.code = prismaError.code;
        }
        break;
      case 'P2025':
        statusCode = 404;
        response.error = 'Not Found';
        response.message = 'The requested resource was not found';
        // Only include Prisma error code in development
        if (isDevelopment) {
          response.code = prismaError.code;
        }
        break;
      case 'P2003':
        statusCode = 400;
        response.error = 'Bad Request';
        response.message = 'Foreign key constraint failed';
        // Only include Prisma error code in development
        if (isDevelopment) {
          response.code = prismaError.code;
        }
        break;
      default:
        response.error = 'Database Error';
        response.message = 'A database error occurred';
        // Only include Prisma error code in development
        if (isDevelopment) {
          response.code = prismaError.code;
        }
    }
  }
  // Fastify errors
  else if (error.statusCode) {
    statusCode = error.statusCode;
    response.error = error.name || 'Error';
    // In production, use generic messages for server errors
    if (statusCode >= 500 && !isDevelopment) {
      response.message = 'An unexpected error occurred';
    } else {
      response.message = error.message;
    }
    // Only include error codes in development
    if (error.code && isDevelopment) {
      response.code = error.code;
    }
  }
  // Generic errors
  else if (error.message) {
    // In production, don't expose internal error messages
    if (!isDevelopment) {
      response.message = 'An unexpected error occurred';
    } else {
      response.message = error.message;
    }
  }

  // Include stack trace in development
  if (isDevelopment && error.stack) {
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








