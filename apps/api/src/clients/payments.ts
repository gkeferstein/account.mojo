import env from '../lib/env.js';
import type { Subscription, Invoice, Entitlement, AppEntitlementsResponse } from '@accounts/shared';
import { BaseHttpClient } from '../lib/http-client.js';
import { TENANT_HEADERS } from '../lib/constants.js';

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
  private mockMode: boolean;

  constructor() {
    super({
      baseUrl: env.PAYMENTS_API_URL,
      apiKey: env.PAYMENTS_API_KEY,
      timeout: 10000, // 10 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second initial delay
    });
    
    this.mockMode = env.MOCK_EXTERNAL_SERVICES || !env.PAYMENTS_API_KEY;
    
    if (this.mockMode) {
      console.log('📦 PaymentsClient running in mock mode');
    }
  }

  /**
   * Internal fetch with tenant headers and retry logic
   */
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.fetchWithRetry<T>(endpoint, {
      ...options,
      headers: {
        // Use standardized @mojo/tenant headers
        [TENANT_HEADERS.SERVICE_NAME]: 'accounts.mojo',
        ...options.headers,
      },
    });
  }

  async getSubscription(userId: string, tenantId: string): Promise<Subscription | null> {
    if (this.mockMode) {
      // Simulate some delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockSubscription;
    }

    try {
      // Note: payments.mojo returns the subscription directly, not wrapped in {success, data}
      return await this.fetch<Subscription>(`/me/subscription?userId=${userId}&tenantId=${tenantId}`);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      return null;
    }
  }

  async getInvoices(userId: string, tenantId: string): Promise<Invoice[]> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockInvoices;
    }

    try {
      // Note: payments.mojo returns the array directly, not wrapped in {success, data}
      return await this.fetch<Invoice[]>(`/me/invoices?userId=${userId}&tenantId=${tenantId}`);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      return [];
    }
  }

  async getEntitlements(userId: string, tenantId: string): Promise<Entitlement[]> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockEntitlements;
    }

    try {
      // Note: payments.mojo returns the array directly, not wrapped in {success, data}
      return await this.fetch<Entitlement[]>(`/me/entitlements?userId=${userId}&tenantId=${tenantId}`);
    } catch (error) {
      console.error('Failed to fetch entitlements:', error);
      return [];
    }
  }

  /**
   * Get app access entitlements for navigation
   * Returns which MOJO platform apps the user has access to
   */
  async getAppEntitlements(userId: string, tenantId: string): Promise<AppEntitlementsResponse> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockAppEntitlements;
    }

    try {
      return await this.fetch<AppEntitlementsResponse>(`/me/app-entitlements?userId=${userId}&tenantId=${tenantId}`);
    } catch (error) {
      console.error('Failed to fetch app entitlements:', error);
      return { entitlements: [], isPlatformAdmin: false };
    }
  }

  async createBillingPortalSession(userId: string, tenantId: string, returnUrl: string): Promise<BillingPortalResponse> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        url: `https://billing.stripe.com/mock-session?return_url=${encodeURIComponent(returnUrl)}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    // Note: payments.mojo returns {url, expiresAt} directly
    return await this.fetch<BillingPortalResponse>('/me/billing-portal-session', {
      method: 'POST',
      body: JSON.stringify({ userId, tenantId, returnUrl }),
    });
  }

  /**
   * Get GDPR export data from payments.mojo
   * Used for DSGVO "Right to Access" (Art. 15)
   */
  async getGdprExport(clerkUserId: string): Promise<any> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        customer: { id: 'mock-customer', email: 'mock@example.com' },
        orders: [],
        payments: [],
        invoices: [],
        exported_at: new Date().toISOString(),
      };
    }

    try {
      return await this.fetch<any>(`/internal/gdpr/export-by-clerk/${clerkUserId}`);
    } catch (error) {
      console.error('Failed to fetch GDPR export from payments.mojo:', error);
      throw error;
    }
  }

  /**
   * Anonymize customer data in payments.mojo
   * Used for DSGVO "Right to be Forgotten" (Art. 17)
   */
  async anonymizeCustomer(clerkUserId: string, reason: string, requestId?: string): Promise<any> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
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
      };
    }

    try {
      return await this.fetch<any>(`/internal/gdpr/anonymize-by-clerk/${clerkUserId}`, {
        method: 'POST',
        body: JSON.stringify({ reason, request_id: requestId }),
      });
    } catch (error) {
      console.error('Failed to anonymize customer in payments.mojo:', error);
      throw error;
    }
  }

  /**
   * Get data portability export from payments.mojo
   * Used for DSGVO "Right to Data Portability" (Art. 20)
   */
  async getDataPortability(clerkUserId: string, format: 'json' | 'csv' | 'xml' = 'json'): Promise<string> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return JSON.stringify({
        customer: { id: 'mock-customer', email: 'mock@example.com' },
        orders: [],
        payments: [],
        invoices: [],
        exported_at: new Date().toISOString(),
      });
    }

    // Use fetchWithRetry but return text instead of JSON
    try {
      // Override the fetch to return text
      const url = `/internal/gdpr/data-portability-by-clerk/${clerkUserId}?format=${format}`;
      const response = await this.fetchWithRetry<Response>(
        url,
        {
          method: 'GET',
        },
        {
          maxRetries: 3,
        }
      ) as unknown as Response;
      
      // Note: fetchWithRetry returns JSON by default, but we need text
      // For now, use a direct fetch with timeout/retry wrapper
      return await (response as any).text();
    } catch (error) {
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
          const error = await response.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }
        
        return await response.text();
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error('Failed to fetch data portability export from payments.mojo:', fetchError);
        throw fetchError;
      }
    }
  }
}

// Singleton instance
export const paymentsClient = new PaymentsClient();

export default paymentsClient;


