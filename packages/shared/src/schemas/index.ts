import { z } from 'zod';

// Common schemas
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const slugSchema = z.string().min(2).max(50).regex(/^[a-z0-9-]+$/);

// Role schemas
export const tenantRoleSchema = z.enum(['owner', 'admin', 'member', 'billing_admin', 'support_readonly']);
export const membershipStatusSchema = z.enum(['active', 'invited', 'suspended', 'removed']);
export const invitationStatusSchema = z.enum(['pending', 'accepted', 'expired', 'revoked']);

// Profile schemas
export const profileSchema = z.object({
  firstName: z.string().max(100).nullable(),
  lastName: z.string().max(100).nullable(),
  email: emailSchema,
  phone: z.string().max(50).nullable(),
  company: z.string().max(200).nullable(),
  street: z.string().max(200).nullable(),
  city: z.string().max(100).nullable(),
  postalCode: z.string().max(20).nullable(),
  country: z.string().length(2).nullable(),
  vatId: z.string().max(50).nullable(),
});

export const profileUpdateSchema = profileSchema.partial().omit({ email: true });

// Tenant schemas
export const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: slugSchema.optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: slugSchema.optional(),
  logoUrl: z.string().url().nullable().optional(),
});

// Invitation schemas
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: tenantRoleSchema.exclude(['owner']),
});

export const updateMemberRoleSchema = z.object({
  role: tenantRoleSchema.exclude(['owner']),
});

// Preferences schemas
export const preferencesSchema = z.object({
  newsletter: z.boolean(),
  productUpdates: z.boolean(),
  marketingEmails: z.boolean(),
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  language: z.string().length(2).default('de'),
  timezone: z.string().default('Europe/Berlin'),
});

export const preferencesUpdateSchema = preferencesSchema.partial();

// Data request schemas
export const dataRequestTypeSchema = z.enum(['export', 'delete']);

export const createDataRequestSchema = z.object({
  type: dataRequestTypeSchema,
  reason: z.string().max(500).optional(),
});

// Consent schemas
export const consentUpdateSchema = z.object({
  type: z.string().min(1).max(50),
  granted: z.boolean(),
});

export const consentsUpdateSchema = z.object({
  consents: z.array(consentUpdateSchema),
});

// Switch tenant schema
export const switchTenantSchema = z.object({
  tenantId: uuidSchema,
});

// Webhook schemas
export const webhookPayloadSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
});

// Query params schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Export type inferences
export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type PreferencesUpdateInput = z.infer<typeof preferencesUpdateSchema>;
export type CreateDataRequestInput = z.infer<typeof createDataRequestSchema>;
export type ConsentUpdateInput = z.infer<typeof consentUpdateSchema>;
export type ConsentsUpdateInput = z.infer<typeof consentsUpdateSchema>;
export type SwitchTenantInput = z.infer<typeof switchTenantSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;





