import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Skip if @fastify/compress is not installed
let compress: any;
try {
  compress = await import('@fastify/compress');
} catch {
  // Module not available
}

describe.skipIf(!compress)('API Compression', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify({
      logger: false,
    });

    await fastify.register(compress.default || compress, {
      encodings: ['gzip', 'deflate'],
      threshold: 1024,
    });

    fastify.get('/test', async (request, reply) => {
      // Generate response > 1KB to trigger compression
      const largeData = 'x'.repeat(2000);
      return reply.send({ data: largeData });
    });
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should compress responses larger than threshold', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'accept-encoding': 'gzip',
      },
    });

    // Check if compression header is present
    expect(response.headers['content-encoding']).toBe('gzip');
    expect(response.statusCode).toBe(200);
  });

  it('should not compress responses smaller than threshold', async () => {
    fastify.get('/small', async (request, reply) => {
      return reply.send({ data: 'small' });
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/small',
      headers: {
        'accept-encoding': 'gzip',
      },
    });

    // Should not have content-encoding header
    expect(response.headers['content-encoding']).toBeUndefined();
    expect(response.statusCode).toBe(200);
  });
});

