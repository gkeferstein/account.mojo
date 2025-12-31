// Re-export all types
export * from './types/index.js';

// Re-export all schemas
export * from './schemas/index.js';

// Utility functions
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

export function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

export function formatDate(date: Date | string, locale: string = 'de-DE'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string, locale: string = 'de-DE'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Role hierarchy for RBAC
export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 80,
  billing_admin: 60,
  member: 40,
  support_readonly: 20,
};

export function hasPermission(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 100;
  return userLevel >= requiredLevel;
}

export function canManageRole(userRole: string, targetRole: string): boolean {
  // Users can only manage roles below their level
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? 100;
  return userLevel > targetLevel;
}








