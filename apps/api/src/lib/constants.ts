/**
 * Centralized Constants
 * 
 * Avoids duplication across multiple files
 */

/**
 * Standardized tenant headers for service-to-service communication
 * Used by accounts.mojo when calling other MOJO services
 */
export const TENANT_HEADERS = {
  TENANT_ID: 'x-tenant-id',
  TENANT_SLUG: 'x-tenant-slug',
  SERVICE_NAME: 'x-service-name',
} as const;

/**
 * Cache TTL values in milliseconds
 */
export const CACHE_TTL = {
  PROFILE: 5 * 60 * 1000,      // 5 minutes
  BILLING: 60 * 1000,          // 1 minute
  ENTITLEMENTS: 5 * 60 * 1000, // 5 minutes
} as const;

