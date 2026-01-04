import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { meRoutes } from '../me.js';

// Mock Fastify instance
const mockFastify = {
  get: vi.fn(),
  post: vi.fn(),
} as unknown as FastifyInstance;

// Mock request/reply objects
const createMockRequest = (headers: Record<string, string> = {}) => ({
  headers,
  auth: {
    userId: 'user_123',
    clerkUserId: 'clerk_123',
    clerkOrgId: null,
    user: {
      id: 'user_123',
      clerkUserId: 'clerk_123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: null,
    },
    activeTenant: {
      id: 'tenant_123',
      name: 'Test Tenant',
      slug: 'test-tenant',
      isPersonal: true,
      clerkOrgId: null,
    },
    activeMembership: {
      id: 'membership_123',
      role: 'owner',
    },
    tenants: [
      {
        id: 'tenant_123',
        name: 'Test Tenant',
        slug: 'test-tenant',
        isPersonal: true,
        clerkOrgId: null,
        membership: {
          id: 'membership_123',
          role: 'owner',
        },
      },
    ],
  },
  log: {
    info: vi.fn(),
  },
});

const createMockReply = () => {
  const reply = {
    status: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply;
};

describe('ETag Caching for /me endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate ETag for session data', async () => {
    const request = createMockRequest();
    const reply = createMockReply();

    // Register routes
    await meRoutes(mockFastify);

    // Get the registered handler
    const getHandler = (mockFastify.get as any).mock.calls.find(
      (call: any[]) => call[0] === '/me'
    )?.[1];

    if (!getHandler) {
      throw new Error('GET /me handler not found');
    }

    await getHandler(request, reply);

    // Verify ETag header was set
    expect(reply.header).toHaveBeenCalledWith(
      'ETag',
      expect.stringMatching(/^".*"$/)
    );
    expect(reply.header).toHaveBeenCalledWith(
      'Cache-Control',
      'private, max-age=60'
    );
  });

  it('should return 304 Not Modified when ETag matches', async () => {
    // First request - get ETag
    const request1 = createMockRequest();
    const reply1 = createMockReply();

    await meRoutes(mockFastify);
    const getHandler = (mockFastify.get as any).mock.calls.find(
      (call: any[]) => call[0] === '/me'
    )?.[1];

    await getHandler(request1, reply1);

    // Get the ETag from first response
    const etagCall = reply1.header.mock.calls.find(
      (call: any[]) => call[0] === 'ETag'
    );
    const etag = etagCall?.[1];

    // Second request with matching ETag
    const request2 = createMockRequest({
      'if-none-match': etag as string,
    });
    const reply2 = createMockReply();

    await getHandler(request2, reply2);

    // Should return 304
    expect(reply2.status).toHaveBeenCalledWith(304);
    expect(reply2.send).toHaveBeenCalled();
  });

  it('should return 200 when ETag does not match', async () => {
    const request = createMockRequest({
      'if-none-match': '"old-etag"',
    });
    const reply = createMockReply();

    await meRoutes(mockFastify);
    const getHandler = (mockFastify.get as any).mock.calls.find(
      (call: any[]) => call[0] === '/me'
    )?.[1];

    await getHandler(request, reply);

    // Should return 200 with new data
    expect(reply.header).toHaveBeenCalledWith('ETag', expect.any(String));
    expect(reply.send).toHaveBeenCalled();
  });
});

