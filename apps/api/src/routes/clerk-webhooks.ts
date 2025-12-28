import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Webhook } from 'svix';
import { createClerkClient } from '@clerk/backend';
import prisma from '../lib/prisma.js';
import env from '../lib/env.js';
import { crmClient } from '../clients/crm.js';

// Clerk Webhook Event Types
interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
  object: string;
}

interface UserEventData {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  private_metadata?: Record<string, unknown>;
  public_metadata?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

interface OrganizationEventData {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  created_at: number;
  updated_at: number;
  public_metadata?: Record<string, unknown>;
  private_metadata?: Record<string, unknown>;
}

interface MembershipEventData {
  id: string;
  organization: { id: string };
  public_user_data: { user_id: string };
  role: string;
  created_at: number;
  updated_at: number;
}

// Initialize Clerk client for API calls
const clerkClient = env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
  : null;

// Map Clerk role to our TenantRole
function mapClerkRoleToTenantRole(clerkRole: string): 'owner' | 'admin' | 'member' | 'billing_admin' {
  switch (clerkRole) {
    case 'org:admin':
    case 'admin':
      return 'admin';
    case 'org:billing_admin':
    case 'billing_admin':
      return 'billing_admin';
    case 'org:owner':
    case 'owner':
      return 'owner';
    default:
      return 'member';
  }
}

// Generate a unique slug for personal org
function generatePersonalSlug(userId: string): string {
  const shortId = userId.replace('user_', '').substring(0, 12);
  return `personal-${shortId}`;
}

export async function clerkWebhooksRoutes(fastify: FastifyInstance): Promise<void> {
  // Add content type parser for raw body (needed for signature verification)
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  // POST /webhooks/clerk - Handle Clerk webhook events
  fastify.post('/clerk', async (request: FastifyRequest, reply: FastifyReply) => {
    const webhookSecret = env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ CLERK_WEBHOOK_SECRET not configured');
      return reply.status(500).send({ error: 'Webhook secret not configured' });
    }

    // Get headers for Svix verification
    const svixId = request.headers['svix-id'] as string;
    const svixTimestamp = request.headers['svix-timestamp'] as string;
    const svixSignature = request.headers['svix-signature'] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('❌ Missing Svix headers');
      return reply.status(400).send({ error: 'Missing webhook headers' });
    }

    // Body is raw string because of our content type parser
    const rawBody = request.body as string;
    if (!rawBody) {
      console.error('❌ Missing raw body');
      return reply.status(400).send({ error: 'Missing request body' });
    }

    // Verify webhook signature using Svix
    let event: ClerkWebhookEvent;
    try {
      const wh = new Webhook(webhookSecret);
      event = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }

    // Check for idempotency - prevent replay attacks
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId: svixId },
    });

    if (existingEvent) {
      console.log(`⚠️ Duplicate webhook event: ${svixId}, skipping`);
      return reply.send({ received: true, processed: false, reason: 'Duplicate event' });
    }

    // Create webhook event record
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        eventId: svixId,
        eventType: event.type,
        source: 'clerk',
        payload: event.data,
        status: 'processing',
        attemptCount: 1,
      },
    });

    console.log(`📥 Clerk webhook received: ${event.type} (${svixId})`);

    try {
      // Process event based on type
      switch (event.type) {
        // ==========================================
        // User Events
        // ==========================================
        case 'user.created': {
          const userData = event.data as unknown as UserEventData;
          const primaryEmail = userData.email_addresses[0]?.email_address || '';
          const platformRole = userData.private_metadata?.platform_role as string | undefined;

          // Create user in our database
          const user = await prisma.user.upsert({
            where: { clerkUserId: userData.id },
            create: {
              clerkUserId: userData.id,
              email: primaryEmail,
              firstName: userData.first_name,
              lastName: userData.last_name,
              avatarUrl: userData.image_url,
              platformRole: platformRole ? mapPlatformRole(platformRole) : null,
              metadata: userData.public_metadata || {},
            },
            update: {
              email: primaryEmail,
              firstName: userData.first_name,
              lastName: userData.last_name,
              avatarUrl: userData.image_url,
            },
          });

          console.log(`✅ User created/updated: ${user.id} (${primaryEmail})`);

          // Create customer in kontakte.mojo (SSOT)
          // This may upgrade an existing lead or create a new customer
          try {
            const crmResult = await crmClient.createCustomer({
              clerkUserId: userData.id,
              email: primaryEmail,
              firstName: userData.first_name || 'Unbekannt',
              lastName: userData.last_name || 'User',
            });

            if (crmResult) {
              if (crmResult.upgraded) {
                console.log(`✅ Lead upgraded to customer in CRM: ${crmResult.accountId}`);
              } else if (crmResult.created) {
                console.log(`✅ Customer created in CRM: ${crmResult.accountId}`);
              } else if (crmResult.existing) {
                console.log(`ℹ️ Customer already exists in CRM: ${crmResult.accountId}`);
              }
            }
          } catch (crmError) {
            // Log error but don't fail the webhook - CRM sync can be retried
            console.error('⚠️ Failed to sync customer to CRM:', crmError);
          }

          // Auto-provision Personal Organization
          await provisionPersonalOrg(userData.id, user.id, userData.first_name, primaryEmail);
          break;
        }

        case 'user.updated': {
          const userData = event.data as unknown as UserEventData;
          const primaryEmail = userData.email_addresses[0]?.email_address || '';
          const platformRole = userData.private_metadata?.platform_role as string | undefined;

          await prisma.user.upsert({
            where: { clerkUserId: userData.id },
            create: {
              clerkUserId: userData.id,
              email: primaryEmail,
              firstName: userData.first_name,
              lastName: userData.last_name,
              avatarUrl: userData.image_url,
              platformRole: platformRole ? mapPlatformRole(platformRole) : null,
              metadata: userData.public_metadata || {},
            },
            update: {
              email: primaryEmail,
              firstName: userData.first_name,
              lastName: userData.last_name,
              avatarUrl: userData.image_url,
              platformRole: platformRole ? mapPlatformRole(platformRole) : null,
              metadata: userData.public_metadata || {},
            },
          });

          console.log(`✅ User updated: ${userData.id}`);
          break;
        }

        case 'user.deleted': {
          const userData = event.data as unknown as { id: string };

          // Soft delete user
          await prisma.user.update({
            where: { clerkUserId: userData.id },
            data: { deletedAt: new Date() },
          });

          console.log(`✅ User soft-deleted: ${userData.id}`);
          break;
        }

        // ==========================================
        // Organization Events
        // ==========================================
        case 'organization.created': {
          const orgData = event.data as unknown as OrganizationEventData;

          await prisma.tenant.upsert({
            where: { clerkOrgId: orgData.id },
            create: {
              clerkOrgId: orgData.id,
              name: orgData.name,
              slug: orgData.slug || `org-${orgData.id.replace('org_', '')}`,
              logoUrl: orgData.image_url,
              isPersonal: false,
              metadata: orgData.public_metadata || {},
            },
            update: {
              name: orgData.name,
              slug: orgData.slug,
              logoUrl: orgData.image_url,
              metadata: orgData.public_metadata || {},
            },
          });

          console.log(`✅ Organization created: ${orgData.id} (${orgData.name})`);
          break;
        }

        case 'organization.updated': {
          const orgData = event.data as unknown as OrganizationEventData;

          await prisma.tenant.upsert({
            where: { clerkOrgId: orgData.id },
            create: {
              clerkOrgId: orgData.id,
              name: orgData.name,
              slug: orgData.slug || `org-${orgData.id.replace('org_', '')}`,
              logoUrl: orgData.image_url,
              isPersonal: false,
              metadata: orgData.public_metadata || {},
            },
            update: {
              name: orgData.name,
              slug: orgData.slug,
              logoUrl: orgData.image_url,
              metadata: orgData.public_metadata || {},
            },
          });

          console.log(`✅ Organization updated: ${orgData.id}`);
          break;
        }

        case 'organization.deleted': {
          const orgData = event.data as unknown as { id: string };

          // Soft delete tenant
          await prisma.tenant.update({
            where: { clerkOrgId: orgData.id },
            data: { deletedAt: new Date() },
          });

          console.log(`✅ Organization soft-deleted: ${orgData.id}`);
          break;
        }

        // ==========================================
        // Organization Membership Events
        // ==========================================
        case 'organizationMembership.created': {
          const memberData = event.data as unknown as MembershipEventData;
          const clerkOrgId = memberData.organization.id;
          const clerkUserId = memberData.public_user_data.user_id;

          // Get or create tenant
          let tenant = await prisma.tenant.findUnique({
            where: { clerkOrgId },
          });

          if (!tenant) {
            // Fetch org details from Clerk and create tenant
            if (clerkClient) {
              try {
                const org = await clerkClient.organizations.getOrganization({ organizationId: clerkOrgId });
                tenant = await prisma.tenant.create({
                  data: {
                    clerkOrgId,
                    name: org.name,
                    slug: org.slug || `org-${clerkOrgId.replace('org_', '')}`,
                    logoUrl: org.imageUrl,
                    isPersonal: false,
                  },
                });
              } catch (err) {
                console.error('Failed to fetch org from Clerk:', err);
                throw new Error(`Tenant not found for org ${clerkOrgId}`);
              }
            } else {
              throw new Error(`Tenant not found for org ${clerkOrgId}`);
            }
          }

          // Get or create user
          let user = await prisma.user.findUnique({
            where: { clerkUserId },
          });

          if (!user) {
            // Fetch user details from Clerk and create user
            if (clerkClient) {
              try {
                const clerkUser = await clerkClient.users.getUser(clerkUserId);
                user = await prisma.user.create({
                  data: {
                    clerkUserId,
                    email: clerkUser.emailAddresses[0]?.emailAddress || '',
                    firstName: clerkUser.firstName,
                    lastName: clerkUser.lastName,
                    avatarUrl: clerkUser.imageUrl,
                  },
                });
              } catch (err) {
                console.error('Failed to fetch user from Clerk:', err);
                throw new Error(`User not found for ${clerkUserId}`);
              }
            } else {
              throw new Error(`User not found for ${clerkUserId}`);
            }
          }

          // Create or update membership
          await prisma.tenantMembership.upsert({
            where: {
              tenantId_userId: {
                tenantId: tenant.id,
                userId: user.id,
              },
            },
            create: {
              clerkMembershipId: memberData.id,
              tenantId: tenant.id,
              userId: user.id,
              role: mapClerkRoleToTenantRole(memberData.role),
              status: 'active',
            },
            update: {
              clerkMembershipId: memberData.id,
              role: mapClerkRoleToTenantRole(memberData.role),
              status: 'active',
            },
          });

          // Set owner if role is owner
          if (memberData.role === 'org:admin' || memberData.role === 'admin') {
            await prisma.tenant.update({
              where: { id: tenant.id },
              data: { ownerUserId: user.id },
            });
          }

          console.log(`✅ Membership created: ${clerkUserId} -> ${clerkOrgId} (${memberData.role})`);
          break;
        }

        case 'organizationMembership.updated': {
          const memberData = event.data as unknown as MembershipEventData;

          const membership = await prisma.tenantMembership.findUnique({
            where: { clerkMembershipId: memberData.id },
          });

          if (membership) {
            await prisma.tenantMembership.update({
              where: { id: membership.id },
              data: {
                role: mapClerkRoleToTenantRole(memberData.role),
              },
            });
            console.log(`✅ Membership updated: ${memberData.id} (${memberData.role})`);
          } else {
            console.warn(`⚠️ Membership not found: ${memberData.id}`);
          }
          break;
        }

        case 'organizationMembership.deleted': {
          const memberData = event.data as unknown as MembershipEventData;

          const membership = await prisma.tenantMembership.findUnique({
            where: { clerkMembershipId: memberData.id },
          });

          if (membership) {
            await prisma.tenantMembership.update({
              where: { id: membership.id },
              data: { status: 'removed' },
            });
            console.log(`✅ Membership removed: ${memberData.id}`);
          }
          break;
        }

        default:
          console.log(`⚠️ Unhandled Clerk event type: ${event.type}`);
      }

      // Mark webhook as successful
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'success',
          processedAt: new Date(),
        },
      });

      return reply.send({ received: true, processed: true });
    } catch (error) {
      console.error(`❌ Error processing webhook ${event.type}:`, error);

      // Mark webhook as failed
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return reply.status(500).send({ error: 'Internal error processing webhook' });
    }
  });
}

// Helper: Map platform role string to enum
function mapPlatformRole(role: string): 'platform_admin' | 'platform_support' | 'platform_finance' | 'platform_content_admin' | null {
  switch (role) {
    case 'platform:admin':
    case 'platform_admin':
      return 'platform_admin';
    case 'platform:support':
    case 'platform_support':
      return 'platform_support';
    case 'platform:finance':
    case 'platform_finance':
      return 'platform_finance';
    case 'platform:content_admin':
    case 'platform_content_admin':
      return 'platform_content_admin';
    default:
      return null;
  }
}

// Helper: Provision Personal Organization for new user
async function provisionPersonalOrg(
  clerkUserId: string,
  internalUserId: string,
  firstName: string | null,
  email: string
): Promise<void> {
  if (!clerkClient) {
    console.warn('⚠️ Clerk client not configured, skipping personal org provisioning');
    return;
  }

  try {
    // Check if user already has any organization membership
    const existingMemberships = await clerkClient.users.getOrganizationMembershipList({
      userId: clerkUserId,
    });

    if (existingMemberships.data.length > 0) {
      console.log(`ℹ️ User ${clerkUserId} already has ${existingMemberships.data.length} org(s), skipping personal org`);
      return;
    }

    // Create personal organization in Clerk
    const personalOrgName = firstName ? `${firstName}'s Account` : `${email.split('@')[0]}'s Account`;
    const personalOrgSlug = generatePersonalSlug(clerkUserId);

    const org = await clerkClient.organizations.createOrganization({
      name: personalOrgName,
      slug: personalOrgSlug,
      createdBy: clerkUserId,
    });

    console.log(`✅ Personal org created in Clerk: ${org.id} (${personalOrgSlug})`);

    // Create tenant in our database
    const tenant = await prisma.tenant.create({
      data: {
        clerkOrgId: org.id,
        name: personalOrgName,
        slug: personalOrgSlug,
        isPersonal: true,
        ownerUserId: internalUserId,
      },
    });

    // Create owner membership
    await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: internalUserId,
        role: 'owner',
        status: 'active',
      },
    });

    // Create default preferences for personal tenant
    await prisma.preferences.create({
      data: {
        tenantId: tenant.id,
        userId: internalUserId,
      },
    });

    console.log(`✅ Personal tenant created: ${tenant.id} for user ${internalUserId}`);
  } catch (error) {
    console.error('❌ Failed to provision personal org:', error);
    // Don't throw - personal org provisioning failure shouldn't block user creation
  }
}

export default clerkWebhooksRoutes;

