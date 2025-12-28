const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiError {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string | null
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: "Unknown Error",
        message: `HTTP ${response.status}`,
      }));
      throw new Error(error.message || "An error occurred");
    }

    return response.json();
  }

  async get<T>(endpoint: string, token?: string | null): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" }, token);
  }

  async post<T>(endpoint: string, data?: unknown, token?: string | null): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: "POST",
        body: data ? JSON.stringify(data) : undefined,
      },
      token
    );
  }

  async patch<T>(endpoint: string, data: unknown, token?: string | null): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      token
    );
  }

  async delete<T>(endpoint: string, token?: string | null): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" }, token);
  }
}

export const api = new ApiClient();

// Type-safe API methods
export const accountsApi = {
  // Session
  getMe: (token: string) => api.get<{
    user: {
      id: string;
      clerkUserId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
    };
    tenants: Array<{
      id: string;
      name: string;
      slug: string;
      role: string;
      isPersonal: boolean;
    }>;
    activeTenantId: string | null;
    activeTenant: {
      id: string;
      name: string;
      slug: string;
      role: string;
      isPersonal: boolean;
    } | null;
  }>("/api/v1/me", token),

  switchTenant: (token: string, tenantId: string) =>
    api.post<{ success: boolean; activeTenant: unknown }>("/api/v1/tenants/switch", { tenantId }, token),

  // Tenants
  getTenants: (token: string) =>
    api.get<{ tenants: Array<{ id: string; name: string; slug: string; logoUrl: string | null; isPersonal: boolean; role: string; memberCount: number; createdAt: string }> }>("/api/v1/tenants", token),

  createTenant: (token: string, data: { name: string; slug?: string }) =>
    api.post<{ id: string; name: string; slug: string }>("/api/v1/tenants", data, token),

  getTenant: (token: string, tenantId: string) =>
    api.get<{
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      isPersonal: boolean;
      memberCount: number;
      members: Array<{
        id: string;
        userId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
        role: string;
        joinedAt: string;
      }>;
      pendingInvitations: Array<{
        id: string;
        email: string;
        role: string;
        expiresAt: string;
        createdAt: string;
      }>;
    }>(`/api/v1/tenants/${tenantId}`, token),

  updateTenant: (token: string, tenantId: string, data: { name?: string; slug?: string; logoUrl?: string | null }) =>
    api.patch(`/api/v1/tenants/${tenantId}`, data, token),

  inviteMember: (token: string, tenantId: string, data: { email: string; role: string }) =>
    api.post(`/api/v1/tenants/${tenantId}/invite`, data, token),

  updateMemberRole: (token: string, tenantId: string, memberId: string, role: string) =>
    api.post(`/api/v1/tenants/${tenantId}/members/${memberId}/role`, { role }, token),

  removeMember: (token: string, tenantId: string, memberId: string) =>
    api.delete(`/api/v1/tenants/${tenantId}/members/${memberId}`, token),

  revokeInvitation: (token: string, tenantId: string, invitationId: string) =>
    api.delete(`/api/v1/tenants/${tenantId}/invitations/${invitationId}`, token),

  // Profile
  getProfile: (token: string) =>
    api.get<{
      firstName: string | null;
      lastName: string | null;
      email: string;
      phone: string | null;
      company: string | null;
      street: string | null;
      city: string | null;
      postalCode: string | null;
      country: string | null;
      vatId: string | null;
    }>("/api/v1/profile", token),

  updateProfile: (token: string, data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    company: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
    vatId: string;
  }>) => api.patch("/api/v1/profile", data, token),

  getConsents: (token: string) =>
    api.get<{ consents: Array<{ type: string; granted: boolean; grantedAt: string | null; source: string | null }> }>("/api/v1/profile/consents", token),

  updateConsents: (token: string, consents: Array<{ type: string; granted: boolean }>) =>
    api.patch("/api/v1/profile/consents", { consents }, token),

  // Preferences
  getPreferences: (token: string) =>
    api.get<{
      newsletter: boolean;
      productUpdates: boolean;
      marketingEmails: boolean;
      emailNotifications: boolean;
      pushNotifications: boolean;
      language: string;
      timezone: string;
    }>("/api/v1/preferences", token),

  updatePreferences: (token: string, data: Partial<{
    newsletter: boolean;
    productUpdates: boolean;
    marketingEmails: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
    language: string;
    timezone: string;
  }>) => api.patch("/api/v1/preferences", data, token),

  // Billing
  getSubscription: (token: string) =>
    api.get<{
      subscription: {
        id: string;
        status: string;
        planId: string;
        planName: string;
        currentPeriodStart: string;
        currentPeriodEnd: string;
        cancelAtPeriodEnd: boolean;
      } | null;
    }>("/api/v1/billing/subscription", token),

  getInvoices: (token: string) =>
    api.get<{
      invoices: Array<{
        id: string;
        number: string;
        status: string;
        amount: number;
        currency: string;
        createdAt: string;
        pdfUrl: string | null;
      }>;
    }>("/api/v1/billing/invoices", token),

  createBillingPortalSession: (token: string, returnUrl?: string) =>
    api.post<{ url: string; expiresAt: string }>("/api/v1/billing/portal", { returnUrl }, token),

  // Entitlements
  getEntitlements: (token: string) =>
    api.get<{
      entitlements: Array<{
        id: string;
        type: string;
        resourceId: string | null;
        resourceName: string | null;
        expiresAt: string | null;
        metadata: Record<string, unknown>;
      }>;
      grouped: {
        courseAccess: Array<unknown>;
        featureFlags: Array<unknown>;
        resourceLimits: Array<unknown>;
      };
      total: number;
    }>("/api/v1/entitlements", token),

  // Data requests
  getDataRequests: (token: string) =>
    api.get<{
      requests: Array<{
        id: string;
        type: string;
        status: string;
        createdAt: string;
        completedAt: string | null;
        downloadUrl: string | null;
      }>;
    }>("/api/v1/data/requests", token),

  requestDataExport: (token: string) =>
    api.post<{ id: string; type: string; status: string; message: string }>("/api/v1/data/export-request", {}, token),

  requestDataDeletion: (token: string, reason?: string) =>
    api.post<{ id: string; type: string; status: string; message: string }>("/api/v1/data/delete-request", { reason }, token),

  cancelDataRequest: (token: string, requestId: string) =>
    api.delete<{ success: boolean }>(`/api/v1/data/requests/${requestId}`, token),
};

export default api;


