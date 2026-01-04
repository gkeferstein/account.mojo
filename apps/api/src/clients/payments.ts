import env from '../lib/env.js';
import type { Subscription, Invoice, Entitlement, AppEntitlementsResponse } from '@accounts/shared';
import { BaseHttpClient } from '../lib/http-client.js';
import { TENANT_HEADERS } from '../lib/constants.js';
import { appLogger } from '../lib/logger.js';

interface BillingPortalResponse {
  url: string;
  expiresAt: string;
}

// Mock data for development
const mockSubscription: Subscription = {
  id: 'sub_mock_123',
  status: 'active',
  planId: 'plan_premium',
  planName: 'MOJO Premium',
  currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  cancelAtPeriodEnd: false,
};

const mockInvoices: Invoice[] = [
  {
    id: 'inv_mock_001',
    number: 'INV-2024-001',
    status: 'paid',
    amount: 9900,
    currency: 'EUR',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    pdfUrl: 'https://example.com/invoice.pdf',
  },
  {
    id: 'inv_mock_002',
    number: 'INV-2024-002',
    status: 'paid',
    amount: 9900,
    currency: 'EUR',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    pdfUrl: 'https://example.com/invoice2.pdf',
  },
];

const mockEntitlements: Entitlement[] = [
  {
    id: 'ent_mock_001',
    type: 'course',
    resourceId: 'course_101',
    resourceName: 'MOJO Grundlagen',
    expiresAt: null,
    metadata: { enrolled: true },
  },
  {
    id: 'ent_mock_002',
    type: 'course',
    resourceId: 'course_102',
    resourceName: 'Fortgeschrittene Techniken',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    metadata: { enrolled: true },
  },
  {
    id: 'ent_mock_003',
    type: 'feature',
    resourceId: 'premium_support',
    resourceName: 'Premium Support',
    expiresAt: null,
    metadata: { enabled: true },
  },
];

const mockAppEntitlements: AppEntitlementsResponse = {
  entitlements: ['pos:access', 'payments:admin'],
  isPlatformAdmin: false,
};

export class PaymentsClient extends BaseHttpClient {
  constructor() {
    const mockMode = env.MOCK_EXTERNAL_SERVICES || !env.PAYMENTS_API_KEY;
    
    super({
      baseUrl: env.PAYMENTS_API_URL,
      apiKey: env.PAYMENTS_API_KEY,
      timeout: 10000, // 10 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second initial delay
    }, mockMode);
    
    if (mockMode) {
      appLogger.info('PaymentsClient running in mock mode');
    }
  }

  /**
   * Internal fetch with tenant headers and retry logic
   */
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.fetchWithRetry<T>(endpoint, {
      ...options,
      headers: {
        // Use standardized @gkeferstein/tenant headers
        [TENANT_HEADERS.SERVICE_NAME]: 'accounts.mojo',
        ...options.headers,
      },
    });
  }

  async getSubscription(userId: string, tenantId: string): Promise<Subscription | null> {
    return this.withMock(
      mockSubscription,
      () => this.fetch<Subscription>(`/me/subscription?userId=${userId}&tenantId=${tenantId}`),
      (error) => {
        appLogger.error('Failed to fetch subscription', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          tenantId,
        });
        return null;
      }
    );
  }

  async getInvoices(userId: string, tenantId: string): Promise<Invoice[]> {
    return this.withMock(
      mockInvoices,
      () => this.fetch<Invoice[]>(`/me/invoices?userId=${userId}&tenantId=${tenantId}`),
      (error) => {
        appLogger.error('Failed to fetch invoices', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          tenantId,
        });
        return [];
      }
    );
  }

  /**
   * Get statements (revenue statements) from payments.mojo
   * Similar to /statements endpoint in payments.mojo
   */
  async getStatements(userId: string, tenantId: string): Promise<any[]> {
    return this.withMock(
      [],
      () => this.fetch<any[]>(`/me/statements?userId=${userId}&tenantId=${tenantId}`),
      (error) => {
        appLogger.error('Failed to fetch statements', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          tenantId,
        });
        return [];
      }
    );
  }

  async getEntitlements(userId: string, tenantId: string): Promise<Entitlement[]> {
    return this.withMock(
      mockEntitlements,
      () => this.fetch<Entitlement[]>(`/me/entitlements?userId=${userId}&tenantId=${tenantId}`),
      (error) => {
        appLogger.error('Failed to fetch entitlements', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          tenantId,
        });
        return [];
      }
    );
  }

  /**
   * Get app access entitlements for navigation
   * Returns which MOJO platform apps the user has access to
   */
  async getAppEntitlements(userId: string, tenantId: string): Promise<AppEntitlementsResponse> {
    return this.withMock(
      mockAppEntitlements,
      () => this.fetch<AppEntitlementsResponse>(`/me/app-entitlements?userId=${userId}&tenantId=${tenantId}`),
      (error) => {
        appLogger.error('Failed to fetch app entitlements', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          tenantId,
        });
        return { entitlements: [], isPlatformAdmin: false };
      }
    );
  }

  async createBillingPortalSession(userId: string, tenantId: string, returnUrl: string): Promise<BillingPortalResponse> {
    return this.withMock(
      {
        url: `https://billing.stripe.com/mock-session?return_url=${encodeURIComponent(returnUrl)}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      () => this.fetch<BillingPortalResponse>('/me/billing-portal-session', {
        method: 'POST',
        body: JSON.stringify({ userId, tenantId, returnUrl }),
      })
    );
  }

  /**
   * Get GDPR export data from payments.mojo
   * Used for DSGVO "Right to Access" (Art. 15)
   */
  async getGdprExport(clerkUserId: string): Promise<any> {
    return this.withMock(
      {
        customer: { id: 'mock-customer', email: 'mock@example.com' },
        orders: [],
        payments: [],
        invoices: [],
        exported_at: new Date().toISOString(),
      },
      () => this.fetch<any>(`/internal/gdpr/export-by-clerk/${clerkUserId}`),
      (error) => {
        appLogger.error('Failed to fetch GDPR export from payments.mojo', {
          error: error instanceof Error ? error.message : String(error),
          clerkUserId,
        });
        throw error; // Critical operation, throw error
      }
    );
  }

  /**
   * Anonymize customer data in payments.mojo
   * Used for DSGVO "Right to be Forgotten" (Art. 17)
   */
  async anonymizeCustomer(clerkUserId: string, reason: string, requestId?: string): Promise<any> {
    return this.withMock(
      {
        success: true,
        customer_id: 'mock-customer',
        anonymized_at: new Date().toISOString(),
        anonymized_fields: ['email', 'name'],
        preserved_data: {
          orders_count: 0,
          payments_count: 0,
          invoices_count: 0,
          reason: 'GoBD Aufbewahrungspflicht (10 Jahre)',
        },
      },
      () => this.fetch<any>(`/internal/gdpr/anonymize-by-clerk/${clerkUserId}`, {
        method: 'POST',
        body: JSON.stringify({ reason, request_id: requestId }),
      }),
      (error) => {
        appLogger.error('Failed to anonymize customer in payments.mojo', {
          error: error instanceof Error ? error.message : String(error),
          clerkUserId,
          reason,
        });
        throw error; // Critical operation, throw error
      }
    );
  }

  /**
   * Get data portability export from payments.mojo
   * Used for DSGVO "Right to Data Portability" (Art. 20)
   */
  async getDataPortability(clerkUserId: string, format: 'json' | 'csv' | 'xml' = 'json'): Promise<string> {
    return this.withMock(
      JSON.stringify({
        customer: { id: 'mock-customer', email: 'mock@example.com' },
        orders: [],
        payments: [],
        invoices: [],
        exported_at: new Date().toISOString(),
      }),
      async () => {
        // Use fetchWithRetry but return text instead of JSON
        // Fallback: direct fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
          const response = await fetch(`${this['config'].baseUrl}/internal/gdpr/data-portability-by-clerk/${clerkUserId}?format=${format}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this['config'].apiKey}`,
              [TENANT_HEADERS.SERVICE_NAME]: 'accounts.mojo',
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
            throw new Error(error.message || `HTTP ${response.status}`);
          }
          
          return await response.text();
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      },
      (error) => {
        appLogger.error('Failed to fetch data portability export from payments.mojo', {
          error: error instanceof Error ? error.message : String(error),
          clerkUserId,
          format,
        });
        throw error; // Critical operation, throw error
      }
    );
  }
}

// Singleton instance
export const paymentsClient = new PaymentsClient();

export default paymentsClient;


