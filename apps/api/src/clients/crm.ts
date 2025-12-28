import env from '../lib/env.js';
import type { Profile, Consent } from '@accounts/shared';

interface CrmClientConfig {
  baseUrl: string;
  apiKey: string;
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

export class CrmClient {
  private config: CrmClientConfig;
  private mockMode: boolean;

  constructor() {
    this.config = {
      baseUrl: env.CRM_API_URL,
      apiKey: env.CRM_API_KEY,
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
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getProfile(userId: string, tenantId: string): Promise<Profile | null> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockProfile;
    }

    try {
      return await this.fetch<Profile>(`/me/profile?userId=${userId}&tenantId=${tenantId}`);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  }

  async updateProfile(userId: string, tenantId: string, data: Partial<Profile>): Promise<Profile | null> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { ...mockProfile, ...data };
    }

    try {
      return await this.fetch<Profile>(`/me/profile?userId=${userId}&tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      return null;
    }
  }

  async getConsents(userId: string, tenantId: string): Promise<Consent[]> {
    if (this.mockMode) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return mockConsents;
    }

    try {
      return await this.fetch<Consent[]>(`/me/consents?userId=${userId}&tenantId=${tenantId}`);
    } catch (error) {
      console.error('Failed to fetch consents:', error);
      return [];
    }
  }

  async updateConsents(userId: string, tenantId: string, consents: Array<{ type: string; granted: boolean }>): Promise<Consent[]> {
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
      return await this.fetch<Consent[]>(`/me/consents?userId=${userId}&tenantId=${tenantId}`, {
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

