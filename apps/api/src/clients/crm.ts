import env from '../lib/env.js';
import type { Profile, Consent } from '@accounts/shared';
import { BaseHttpClient } from '../lib/http-client.js';
import { TENANT_HEADERS } from '../lib/constants.js';
import { appLogger } from '../lib/logger.js';

interface CrmClientConfig {
  baseUrl: string;
  apiKey: string;
  tenantSlug: string;
}

// Mock data for development
const mockProfile: Profile = {
  firstName: 'Max',
  lastName: 'Mustermann',
  email: 'demo@mojo-institut.de',
  phone: '+49 123 456789',
  company: 'MOJO Institut GmbH',
  street: 'Musterstraße 123',
  city: 'Berlin',
  postalCode: '10115',
  country: 'DE',
  vatId: 'DE123456789',
};

const mockConsents: Consent[] = [
  {
    type: 'marketing',
    granted: false,
    grantedAt: null,
    source: null,
  },
  {
    type: 'newsletter',
    granted: true,
    grantedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    source: 'registration',
  },
  {
    type: 'analytics',
    granted: true,
    grantedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    source: 'registration',
  },
  {
    type: 'product_updates',
    granted: true,
    grantedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    source: 'preferences',
  },
];

interface CreateCustomerRequest {
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
}

interface CreateCustomerResponse {
  message: string;
  accountId: string;
  partyId?: string;
  created?: boolean;
  upgraded?: boolean;
  existing?: boolean;
}

export class CrmClient extends BaseHttpClient {
  private tenantSlug: string;

  constructor() {
    const mockMode = env.MOCK_EXTERNAL_SERVICES || !env.CRM_API_KEY;
    
    super({
      baseUrl: env.CRM_API_URL,
      apiKey: env.CRM_API_KEY,
      timeout: 10000, // 10 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second initial delay
    }, mockMode);
    
    this.tenantSlug = env.CRM_TENANT_SLUG || 'mojo';
    
    if (mockMode) {
      appLogger.info('CrmClient running in mock mode');
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
        [TENANT_HEADERS.TENANT_SLUG]: this.tenantSlug,
        [TENANT_HEADERS.SERVICE_NAME]: 'accounts.mojo',
        ...options.headers,
      },
    });
  }

  /**
   * Erstellt einen neuen Kunden in kontakte.mojo (SSOT)
   * Wird aufgerufen bei Clerk user.created Webhook
   */
  async createCustomer(data: CreateCustomerRequest): Promise<CreateCustomerResponse | null> {
    return this.withMock(
      {
        message: 'Mock: Customer erstellt.',
        accountId: 'mock-account-id',
        partyId: 'mock-party-id',
        created: true,
      },
      () => this.fetch<CreateCustomerResponse>('/internal/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      (error) => {
        appLogger.error('Failed to create customer in CRM', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        return null;
      }
    );
  }

  /**
   * Sucht einen Kunden per clerkUserId oder Email
   */
  async lookupCustomer(clerkUserId?: string, email?: string): Promise<{
    accountId: string;
    clerkUserId: string | null;
    isLead: boolean;
    email: string;
    firstName: string;
    lastName: string;
  } | null> {
    return this.withMock(
      {
        accountId: 'mock-account-id',
        clerkUserId: clerkUserId || null,
        isLead: !clerkUserId,
        email: email || 'mock@example.com',
        firstName: 'Max',
        lastName: 'Mustermann',
      },
      () => {
        const params = new URLSearchParams();
        if (clerkUserId) params.set('clerkUserId', clerkUserId);
        if (email) params.set('email', email);
        return this.fetch(`/internal/customers/lookup?${params.toString()}`);
      },
      (error) => {
        appLogger.error('Failed to lookup customer', {
          error: error instanceof Error ? error.message : String(error),
          clerkUserId,
          email,
        });
        return null;
      }
    );
  }

  /**
   * Holt Profildaten aus kontakte.mojo (SSOT)
   * @param clerkUserId - Die Clerk User ID
   */
  async getProfile(clerkUserId: string): Promise<Profile | null> {
    return this.withMock(
      mockProfile,
      () => this.fetch<Profile>(`/me/profile?clerkUserId=${clerkUserId}`),
      (error) => {
        appLogger.error('Failed to fetch profile', {
          error: error instanceof Error ? error.message : String(error),
          clerkUserId,
        });
        return null;
      }
    );
  }

  /**
   * Aktualisiert Profildaten in kontakte.mojo (SSOT)
   * @param clerkUserId - Die Clerk User ID
   * @param data - Die zu aktualisierenden Felder
   */
  async updateProfile(clerkUserId: string, data: Partial<Profile>): Promise<Profile | null> {
    return this.withMock(
      { ...mockProfile, ...data },
      () => this.fetch<Profile>(`/me/profile?clerkUserId=${clerkUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
      (error) => {
        appLogger.error('Failed to update profile', {
          error: error instanceof Error ? error.message : String(error),
          clerkUserId,
        });
        return null;
      }
    );
  }

  /**
   * Holt Consent-Daten aus kontakte.mojo (SSOT)
   * @param clerkUserId - Die Clerk User ID
   */
  async getConsents(clerkUserId: string): Promise<Consent[]> {
    return this.withMock(
      mockConsents,
      () => this.fetch<Consent[]>(`/me/consents?clerkUserId=${clerkUserId}`),
      (error) => {
        appLogger.error('Failed to fetch consents', {
          error: error instanceof Error ? error.message : String(error),
          clerkUserId,
        });
        return [];
      }
    );
  }

  /**
   * Aktualisiert Consent-Daten in kontakte.mojo (SSOT)
   * @param clerkUserId - Die Clerk User ID
   * @param consents - Die zu aktualisierenden Consents
   */
  async updateConsents(clerkUserId: string, consents: Array<{ type: string; granted: boolean }>): Promise<Consent[]> {
    return this.withMock(
      mockConsents.map((c) => {
        const update = consents.find((u) => u.type === c.type);
        if (update) {
          return {
            ...c,
            granted: update.granted,
            grantedAt: update.granted ? new Date() : null,
            source: 'preferences',
          };
        }
        return c;
      }),
      () => this.fetch<Consent[]>(`/me/consents?clerkUserId=${clerkUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ consents }),
      }),
      (error) => {
        appLogger.error('Failed to update consents', {
          error: error instanceof Error ? error.message : String(error),
          clerkUserId,
        });
        return [];
      }
    );
  }
}

// Singleton instance
export const crmClient = new CrmClient();

export default crmClient;


