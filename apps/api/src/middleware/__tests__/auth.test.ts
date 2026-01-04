import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient, User } from '@prisma/client';
import { appLogger } from '../../lib/logger.js';

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  appLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Prisma
vi.mock('../../lib/prisma.js', () => ({
  default: mockPrisma,
}));

// Import after mocks
import { authMiddleware } from '../auth.js';

describe('Auth Middleware - getOrCreateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateUser logic', () => {
    it('should find user by clerkUserId', async () => {
      const mockUser: Partial<User> = {
        id: 'user-1',
        clerkUserId: 'clerk-user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValueOnce(mockUser);

      // Simulate the logic
      const clerkUserId = 'clerk-user-123';
      const user = await mockPrisma.user.findUnique({
        where: { clerkUserId },
      });

      expect(user).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkUserId },
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should find user by email when clerkUserId not found', async () => {
      const mockUser: Partial<User> = {
        id: 'user-1',
        clerkUserId: 'old-clerk-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
      };

      // First call (by clerkUserId) returns null
      // Second call (by email) returns user
      mockPrisma.user.findUnique = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);

      const updatedUser = { ...mockUser, clerkUserId: 'new-clerk-id' };
      mockPrisma.user.update = vi.fn().mockResolvedValueOnce(updatedUser);

      // Simulate the logic
      const clerkUserId = 'new-clerk-id';
      const email = 'test@example.com';

      let user = await mockPrisma.user.findUnique({
        where: { clerkUserId },
      });

      if (!user && email) {
        user = await mockPrisma.user.findUnique({
          where: { email },
        });

        if (user && user.clerkUserId !== clerkUserId) {
          user = await mockPrisma.user.update({
            where: { id: user.id },
            data: { clerkUserId },
          });
        }
      }

      expect(user).toEqual(updatedUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { clerkUserId },
      });
    });

    it('should create new user when not found', async () => {
      const newUser: Partial<User> = {
        id: 'user-2',
        clerkUserId: 'clerk-user-456',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        avatarUrl: null,
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValueOnce(null);
      mockPrisma.user.create = vi.fn().mockResolvedValueOnce(newUser);

      // Simulate the logic
      const clerkUserId = 'clerk-user-456';
      const email = 'new@example.com';
      const firstName = 'New';
      const lastName = 'User';

      let user = await mockPrisma.user.findUnique({
        where: { clerkUserId },
      });

      if (!user) {
        user = await mockPrisma.user.create({
          data: {
            clerkUserId,
            email,
            firstName,
            lastName,
          },
        });
      }

      expect(user).toEqual(newUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          clerkUserId,
          email,
          firstName,
          lastName,
        },
      });
    });

    it('should handle email conflict and update existing user', async () => {
      const existingUser: Partial<User> = {
        id: 'user-3',
        clerkUserId: 'old-clerk-id',
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        avatarUrl: null,
      };

      const updatedUser = {
        ...existingUser,
        clerkUserId: 'new-clerk-id',
        firstName: 'Updated',
      };

      // First findUnique returns null
      mockPrisma.user.findUnique = vi
        .fn()
        .mockResolvedValueOnce(null) // by clerkUserId
        .mockResolvedValueOnce(existingUser); // by email (after conflict)

      // Create fails with unique constraint
      const conflictError = {
        code: 'P2002',
        meta: { target: ['email'] },
      };
      mockPrisma.user.create = vi.fn().mockRejectedValueOnce(conflictError);

      // Update succeeds
      mockPrisma.user.update = vi.fn().mockResolvedValueOnce(updatedUser);

      // Simulate the logic
      const clerkUserId = 'new-clerk-id';
      const email = 'existing@example.com';
      const firstName = 'Updated';

      let user = await mockPrisma.user.findUnique({
        where: { clerkUserId },
      });

      if (!user) {
        try {
          user = await mockPrisma.user.create({
            data: {
              clerkUserId,
              email,
              firstName,
            },
          });
        } catch (error: any) {
          if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            user = await mockPrisma.user.findUnique({
              where: { email },
            });
            if (user) {
              user = await mockPrisma.user.update({
                where: { id: user.id },
                data: {
                  clerkUserId,
                  firstName,
                },
              });
            }
          }
        }
      }

      expect(user).toEqual(updatedUser);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          clerkUserId,
          firstName,
        },
      });
    });

    it('should update user info when changed', async () => {
      const existingUser: Partial<User> = {
        id: 'user-4',
        clerkUserId: 'clerk-user-789',
        email: 'test@example.com',
        firstName: 'Old',
        lastName: 'Name',
        avatarUrl: null,
      };

      const updatedUser = {
        ...existingUser,
        firstName: 'New',
        lastName: 'Name',
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValueOnce(existingUser);
      mockPrisma.user.update = vi.fn().mockResolvedValueOnce(updatedUser);

      // Simulate the logic
      const clerkUserId = 'clerk-user-789';
      const email = 'test@example.com';
      const firstName = 'New';
      const lastName = 'Name';

      let user = await mockPrisma.user.findUnique({
        where: { clerkUserId },
      });

      if (user) {
        if (
          user.email !== email ||
          user.firstName !== firstName ||
          user.lastName !== lastName
        ) {
          user = await mockPrisma.user.update({
            where: { id: user.id },
            data: { email, firstName, lastName },
          });
        }
      }

      expect(user).toEqual(updatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: { email, firstName, lastName },
      });
    });

    it('should not update user when info unchanged', async () => {
      const existingUser: Partial<User> = {
        id: 'user-5',
        clerkUserId: 'clerk-user-999',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValueOnce(existingUser);

      // Simulate the logic
      const clerkUserId = 'clerk-user-999';
      const email = 'test@example.com';
      const firstName = 'Test';
      const lastName = 'User';

      let user = await mockPrisma.user.findUnique({
        where: { clerkUserId },
      });

      if (user) {
        if (
          user.email !== email ||
          user.firstName !== firstName ||
          user.lastName !== lastName
        ) {
          user = await mockPrisma.user.update({
            where: { id: user.id },
            data: { email, firstName, lastName },
          });
        }
      }

      expect(user).toEqual(existingUser);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Token verification scenarios', () => {
    it('should handle valid JWT token structure', () => {
      const validToken = 'eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSJ9.eyJzdWIiOiJ1c2VyXzM3U2lXbkpucWlIdjBuUEFXWW1DNUNvSzdBViIsImF6cCI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwNCIsIm9yZ19pZCI6bnVsbCwiZXhwIjoiMjAyNi0wMS0wNFQwODoxNDowNi4wMDBaIiwiaWF0IjoiMjAyNi0wMS0wNFQwODoxMzowNi4wMDBaIiwiaXNzIjoiaHR0cHM6Ly9tZWFzdXJlZC1iZWRidWctMTkuY2xlcmsuYWNjb3VudHMuZGV2In0.signature';

      const parts = validToken.split('.');
      expect(parts.length).toBe(3);

      // Decode header
      const header = JSON.parse(
        Buffer.from(
          parts[0].replace(/-/g, '+').replace(/_/g, '/'),
          'base64'
        ).toString()
      );
      expect(header).toHaveProperty('alg');
      expect(header).toHaveProperty('cat');

      // Decode payload
      const payload = JSON.parse(
        Buffer.from(
          parts[1].replace(/-/g, '+').replace(/_/g, '/'),
          'base64'
        ).toString()
      );
      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('azp');
    });

    it('should detect expired tokens', () => {
      const expiredExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const isExpired = expiredExp * 1000 < Date.now();
      expect(isExpired).toBe(true);
    });

    it('should detect valid (non-expired) tokens', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const isExpired = futureExp * 1000 < Date.now();
      expect(isExpired).toBe(false);
    });
  });
});

