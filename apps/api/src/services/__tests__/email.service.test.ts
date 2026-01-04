import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// Mock Resend - MUST be defined before any imports
const mockResendInstance = {
  emails: {
    send: vi.fn(),
  },
  analytics: {
    retrieve: vi.fn(),
  },
  domains: {
    list: vi.fn(),
  },
};

vi.mock('resend', () => ({
  Resend: vi.fn(() => mockResendInstance),
}));

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  preferences: {
    findUnique: vi.fn(),
  },
} as unknown as PrismaClient;

vi.mock('../../lib/prisma.js', () => ({
  default: mockPrisma,
}));

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  appLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock env
vi.mock('../../lib/env.js', () => ({
  default: {
    RESEND_API_KEY: 'test-api-key',
    EMAIL_FROM: 'MOJO Institut <noreply@mojo-institut.de>',
    FRONTEND_URL: 'http://localhost:3004',
  },
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock functions
    mockResendInstance.emails.send = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email when user preferences allow', async () => {
      const { sendEmail } = await import('../email.service.js');

      const mockUser = {
        id: 'user-1',
        clerkUserId: 'clerk-123',
      };

      const mockPreferences = {
        payload: {
          emailNotifications: true,
        },
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValueOnce(mockUser);
      mockPrisma.preferences.findUnique = vi.fn().mockResolvedValueOnce(
        mockPreferences
      );
      mockResendInstance.emails.send = vi.fn().mockResolvedValueOnce({
        data: { id: 'email-id-123' },
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'tenant-invitation',
        data: {
          tenantName: 'Test Tenant',
          inviterName: 'Test User',
          role: 'member',
          inviteUrl: 'http://localhost:3004/invite?token=abc123',
          expiresAt: new Date(),
        },
        checkPreferences: {
          clerkUserId: 'clerk-123',
          tenantId: 'tenant-1',
          preferenceType: 'emailNotifications',
        },
      });

      expect(result).toEqual({ success: true, messageId: 'email-id-123' });
      expect(mockResendInstance.emails.send).toHaveBeenCalled();
    });

    it('should skip email when user preferences disallow', async () => {
      const { sendEmail } = await import('../email.service.js');

      const mockUser = {
        id: 'user-1',
        clerkUserId: 'clerk-123',
      };

      const mockPreferences = {
        payload: {
          emailNotifications: false,
        },
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValueOnce(mockUser);
      mockPrisma.preferences.findUnique = vi.fn().mockResolvedValueOnce(
        mockPreferences
      );

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'tenant-invitation',
        data: {},
        checkPreferences: {
          clerkUserId: 'clerk-123',
          tenantId: 'tenant-1',
          preferenceType: 'emailNotifications',
        },
      });

      expect(result).toEqual({
        success: true,
        messageId: 'skipped',
      });
      expect(mockResendInstance.emails.send).not.toHaveBeenCalled();
    });

    it('should always send security-alert emails', async () => {
      const { sendEmail } = await import('../email.service.js');

      mockResendInstance.emails.send = vi.fn().mockResolvedValueOnce({
        data: { id: 'email-id-456' },
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Security Alert',
        template: 'security-alert',
        data: {
          message: 'Suspicious activity detected',
        },
        // No checkPreferences - security alerts are always sent
      });

      expect(result).toEqual({ success: true, messageId: 'email-id-456' });
      expect(mockResendInstance.emails.send).toHaveBeenCalled();
    });

    it('should always send password-reset emails', async () => {
      const { sendEmail } = await import('../email.service.js');

      mockResendInstance.emails.send = vi.fn().mockResolvedValueOnce({
        data: { id: 'email-id-789' },
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Password Reset',
        template: 'password-reset',
        data: {
          resetUrl: 'http://localhost:3004/reset?token=xyz789',
        },
        // No checkPreferences - password resets are always sent
      });

      expect(result).toEqual({ success: true, messageId: 'email-id-789' });
      expect(mockResendInstance.emails.send).toHaveBeenCalled();
    });

    it('should handle email sending errors gracefully', async () => {
      const { sendEmail } = await import('../email.service.js');

      const mockUser = {
        id: 'user-1',
        clerkUserId: 'clerk-123',
      };

      const mockPreferences = {
        payload: {
          emailNotifications: true,
        },
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValueOnce(mockUser);
      mockPrisma.preferences.findUnique = vi.fn().mockResolvedValueOnce(
        mockPreferences
      );
      mockResendInstance.emails.send = vi
        .fn()
        .mockRejectedValueOnce(new Error('Resend API error'));

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'tenant-invitation',
        data: {},
        checkPreferences: {
          clerkUserId: 'clerk-123',
          tenantId: 'tenant-1',
          preferenceType: 'emailNotifications',
        },
      });

      expect(result).toEqual({
        success: false,
        error: 'Resend API error',
      });
    });

    it('should default to sending when preferences not found', async () => {
      const { sendEmail } = await import('../email.service.js');

      const mockUser = {
        id: 'user-1',
        clerkUserId: 'clerk-123',
      };

      mockPrisma.user.findUnique = vi.fn().mockResolvedValueOnce(mockUser);
      mockPrisma.preferences.findUnique = vi.fn().mockResolvedValueOnce(null);
      mockResendInstance.emails.send = vi.fn().mockResolvedValueOnce({
        data: { id: 'email-id-default' },
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'tenant-invitation',
        data: {},
        checkPreferences: {
          clerkUserId: 'clerk-123',
          tenantId: 'tenant-1',
          preferenceType: 'emailNotifications',
        },
      });

      expect(result).toEqual({ success: true, messageId: 'email-id-default' });
      expect(mockResendInstance.emails.send).toHaveBeenCalled();
    });
  });
});
