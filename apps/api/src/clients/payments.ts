import env from '../lib/env.js';
import type { Subscription, Invoice, Entitlement } from '@accounts/shared';

interface PaymentsClientConfig {
  baseUrl: string;
  apiKey: string;
}

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
    type: 'course_access',
    resourceId: 'course_101',
    resourceName: 'MOJO Grundlagen',
    expiresAt: null,
    metadata: { enrolled: true },
  },
  {
    id: 'ent_mock_002',
    type: 'course_access',
    resourceId: 'course_102',
    resourceName: 'Fortgeschrittene Techniken',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    metadata: { enrolled: true },
  },
  {
    id: 'ent_mock_003',
    type: 'feature_flag',
    resourceId: 'premium_support',
    resourceName: 'Premium Support',
    expiresAt: null,
    metadata: { enabled: true },
  },
];

export class PaymentsClient {
  private config: PaymentsClientConfig;
  private mockMode: boolean;

  constructor() {
    this.config = {
      baseUrl: env.PAYMENTS_API_URL,
      apiKey: env.PAYMENTS_API_KEY,
    };
    this.mockMode = env.MOCK_EXTERNAL_SERVICES || !this.config.apiKey;
    
    if (this.mockMode) {
      console.log('📦 PaymentsClient running in mock mode');
    }
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getSubscription(userId: string, tenantId: string): Promise<Subscription | null> {
    if (this.mockMode) {
      // Simulate some delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockSubscription;
    }

    try {
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
      return await this.fetch<Entitlement[]>(`/me/entitlements?userId=${userId}&tenantId=${tenantId}`);
    } catch (error) {
      console.error('Failed to fetch entitlements:', error);
      return [];
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

    return await this.fetch<BillingPortalResponse>('/me/billing-portal-session', {
      method: 'POST',
      body: JSON.stringify({ userId, tenantId, returnUrl }),
    });
  }
}

// Singleton instance
export const paymentsClient = new PaymentsClient();

export default paymentsClient;

