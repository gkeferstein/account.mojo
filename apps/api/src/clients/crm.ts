import env from '../lib/env.js';
import type { Profile, Consent } from '@accounts/shared';

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

export class CrmClient {
  private config: CrmClientConfig;
  private mockMode: boolean;

  constructor() {
    this.config = {
      baseUrl: env.CRM_API_URL,
      apiKey: env.CRM_API_KEY,
      tenantSlug: env.CRM_TENANT_SLUG || 'mojo',
    };
    this.mockMode = env.MOCK_EXTERNAL_SERVICES || !this.config.apiKey;
    
    if (this.mockMode) {
      console.log('📦 CrmClient running in mock mode');
    }
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'x-tenant-slug': this.config.tenantSlug,
        'x-service-name': 'accounts.mojo',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Erstellt einen neuen Kunden in kontakte.mojo (SSOT)
   * Wird aufgerufen bei Clerk user.created Webhook
   */
  async createCustomer(data: CreateCustomerRequest): Promise<CreateCustomerResponse | null> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        message: 'Mock: Customer erstellt.',
        accountId: 'mock-account-id',
        partyId: 'mock-party-id',
        created: true,
      };
    }

    try {
      return await this.fetch<CreateCustomerResponse>('/internal/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Failed to create customer in CRM:', error);
      return null;
    }
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
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        accountId: 'mock-account-id',
        clerkUserId: clerkUserId || null,
        isLead: !clerkUserId,
        email: email || 'mock@example.com',
        firstName: 'Max',
        lastName: 'Mustermann',
      };
    }

    try {
      const params = new URLSearchParams();
      if (clerkUserId) params.set('clerkUserId', clerkUserId);
      if (email) params.set('email', email);
      
      return await this.fetch(`/internal/customers/lookup?${params.toString()}`);
    } catch (error) {
      console.error('Failed to lookup customer:', error);
      return null;
    }
  }

  /**
   * Holt Profildaten aus kontakte.mojo (SSOT)
   * @param clerkUserId - Die Clerk User ID
   */
  async getProfile(clerkUserId: string): Promise<Profile | null> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockProfile;
    }

    try {
      return await this.fetch<Profile>(`/me/profile?clerkUserId=${clerkUserId}`);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  }

  /**
   * Aktualisiert Profildaten in kontakte.mojo (SSOT)
   * @param clerkUserId - Die Clerk User ID
   * @param data - Die zu aktualisierenden Felder
   */
  async updateProfile(clerkUserId: string, data: Partial<Profile>): Promise<Profile | null> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { ...mockProfile, ...data };
    }

    try {
      return await this.fetch<Profile>(`/me/profile?clerkUserId=${clerkUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      return null;
    }
  }

  /**
   * Holt Consent-Daten aus kontakte.mojo (SSOT)
   * @param clerkUserId - Die Clerk User ID
   */
  async getConsents(clerkUserId: string): Promise<Consent[]> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockConsents;
    }

    try {
      return await this.fetch<Consent[]>(`/me/consents?clerkUserId=${clerkUserId}`);
    } catch (error) {
      console.error('Failed to fetch consents:', error);
      return [];
    }
  }

  /**
   * Aktualisiert Consent-Daten in kontakte.mojo (SSOT)
   * @param clerkUserId - Die Clerk User ID
   * @param consents - Die zu aktualisierenden Consents
   */
  async updateConsents(clerkUserId: string, consents: Array<{ type: string; granted: boolean }>): Promise<Consent[]> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockConsents.map((c) => {
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
      });
    }

    try {
      return await this.fetch<Consent[]>(`/me/consents?clerkUserId=${clerkUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ consents }),
      });
    } catch (error) {
      console.error('Failed to update consents:', error);
      return [];
    }
  }
}

// Singleton instance
export const crmClient = new CrmClient();

export default crmClient;


