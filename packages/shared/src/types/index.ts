// User Types
export interface User {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Tenant Types
export type TenantRole = 'owner' | 'admin' | 'member' | 'billing_admin' | 'support_readonly';
export type MembershipStatus = 'active' | 'invited' | 'suspended' | 'removed';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  clerkOrgId: string | null;
  logoUrl: string | null;
  isPersonal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

// Profile Types
export interface Profile {
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
}

// Billing Types
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  planId: string;
  planName: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amount: number;
  currency: string;
  createdAt: Date;
  pdfUrl: string | null;
}

// Entitlement Types
// Must match payments.mojo resource_type enum
export type EntitlementResourceType = 
  | 'course' 
  | 'membership' 
  | 'bundle' 
  | 'service' 
  | 'feature' 
  | 'app_access';

export interface Entitlement {
  id: string;
  type: EntitlementResourceType;
  resourceId: string;
  resourceName: string | null;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
}

// App entitlements for navigation
// These are the strings used by design.mojo MojoGlobalHeader
export type AppEntitlement = 
  | 'pos:access'
  | 'checkin:access'
  | 'payments:admin'
  | 'kontakte:admin'
  | 'connect:admin'
  | 'mailer:admin'
  | 'platform:developer';

export interface AppEntitlementsResponse {
  entitlements: AppEntitlement[];
  isPlatformAdmin: boolean;
}

// Preferences Types
export interface Preferences {
  newsletter: boolean;
  productUpdates: boolean;
  marketingEmails: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  language: string;
  timezone: string;
}

// Data Request Types
export type DataRequestType = 'export' | 'delete';
export type DataRequestStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DataRequest {
  id: string;
  type: DataRequestType;
  status: DataRequestStatus;
  createdAt: Date;
  completedAt: Date | null;
  downloadUrl: string | null;
}

// Audit Log Types
export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Session Types
export type PlatformRole = 'platform_admin' | 'platform_support' | 'platform_finance' | 'platform_content_admin' | null;

export interface SessionUser {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  platformRole: PlatformRole;
}

export interface SessionTenant {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
  isPersonal: boolean;
  clerkOrgId: string | null;
}

export interface Session {
  user: SessionUser;
  tenants: SessionTenant[];
  activeTenantId: string | null;
  activeTenant: SessionTenant | null;
}

// Consent Types
export interface Consent {
  type: string;
  granted: boolean;
  grantedAt: Date | null;
  source: string | null;
}

export interface ConsentUpdate {
  type: string;
  granted: boolean;
}





