/**
 * Email Service for accounts.mojo
 * 
 * Centralized email sending service using Resend.
 * Respects user preferences for email notifications.
 * 
 * Used by:
 * - account.mojo (tenant invitations, notifications)
 * - payments.mojo (invoice emails, subscription updates)
 * - kontakte.mojo (marketing emails, newsletters)
 * - Other MOJO services
 */

import { Resend } from 'resend';
import { appLogger } from '../lib/logger.js';
import env from '../lib/env.js';
import prisma from '../lib/prisma.js';

// Initialize Resend client
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template: EmailTemplate;
  data: Record<string, any>;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  metadata?: Record<string, string>;
  // Optional: Check user preferences before sending
  checkPreferences?: {
    clerkUserId?: string;
    tenantId?: string;
    preferenceType?: 'newsletter' | 'marketingEmails' | 'productUpdates' | 'emailNotifications';
  };
}

export type EmailTemplate = 
  | 'tenant-invitation'
  | 'invoice'
  | 'subscription-update'
  | 'newsletter'
  | 'marketing'
  | 'product-update'
  | 'security-alert'
  | 'welcome'
  | 'password-reset'
  | 'account-deleted';

/**
 * Check if email should be sent based on user preferences
 */
async function shouldSendEmail(
  userId: string, // User ID (not clerkUserId)
  tenantId: string,
  preferenceType: 'newsletter' | 'marketingEmails' | 'productUpdates' | 'emailNotifications'
): Promise<boolean> {
  try {
    // Get user preferences
    const preferences = await prisma.preferences.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId, // Use internal user ID
        },
      },
    });

    if (!preferences?.payload) {
      // Default: send if preferences not set (opt-in for critical emails)
      return preferenceType === 'emailNotifications';
    }

    const prefs = preferences.payload as any;
    
    switch (preferenceType) {
      case 'newsletter':
        return prefs.newsletter === true;
      case 'marketingEmails':
        return prefs.marketingEmails === true;
      case 'productUpdates':
        return prefs.productUpdates === true;
      case 'emailNotifications':
        return prefs.emailNotifications !== false; // Default to true
      default:
        return true; // Always send if preference type not specified
    }
  } catch (error) {
    appLogger.warn('Failed to check email preferences, defaulting to send', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      tenantId,
      preferenceType,
    });
    // Default: send if we can't check preferences (fail open for critical emails)
    return true;
  }
}

/**
 * Get email template content
 * TODO: Replace with actual React Email templates
 */
function getEmailContent(template: EmailTemplate, data: Record<string, any>): { html: string; text: string } {
  // For now, return simple HTML/text templates
  // Later: Use React Email templates
  
  switch (template) {
    case 'tenant-invitation':
      return {
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Einladung zu ${data.tenantName || 'einem Team'}</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb;">Einladung zu ${data.tenantName || 'einem Team'}</h1>
              <p>Hallo,</p>
              <p>Du wurdest von <strong>${data.inviterName || 'einem Administrator'}</strong> eingeladen, dem Team <strong>${data.tenantName || ''}</strong> beizutreten.</p>
              <p>Rolle: <strong>${data.role || 'Mitglied'}</strong></p>
              <p style="margin: 30px 0;">
                <a href="${data.inviteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Einladung annehmen</a>
              </p>
              <p style="color: #666; font-size: 14px;">Diese Einladung läuft am ${data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('de-DE') : 'unbekannt'} ab.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #666; font-size: 12px;">Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.</p>
            </body>
          </html>
        `,
        text: `
          Einladung zu ${data.tenantName || 'einem Team'}
          
          Hallo,
          
          Du wurdest von ${data.inviterName || 'einem Administrator'} eingeladen, dem Team ${data.tenantName || ''} beizutreten.
          
          Rolle: ${data.role || 'Mitglied'}
          
          Einladung annehmen: ${data.inviteUrl}
          
          Diese Einladung läuft am ${data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('de-DE') : 'unbekannt'} ab.
          
          Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.
        `,
      };
    
    case 'invoice':
      return {
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Rechnung ${data.invoiceNumber || ''}</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb;">Rechnung ${data.invoiceNumber || ''}</h1>
              <p>Hallo ${data.customerName || 'Kunde'},</p>
              <p>vielen Dank für deine Bestellung. Deine Rechnung ist bereit.</p>
              <p><strong>Betrag:</strong> ${data.amount || '0,00'} ${data.currency || 'EUR'}</p>
              <p><strong>Fälligkeitsdatum:</strong> ${data.dueDate ? new Date(data.dueDate).toLocaleDateString('de-DE') : 'unbekannt'}</p>
              ${data.invoiceUrl ? `<p><a href="${data.invoiceUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Rechnung ansehen</a></p>` : ''}
            </body>
          </html>
        `,
        text: `Rechnung ${data.invoiceNumber || ''}\n\nHallo ${data.customerName || 'Kunde'},\n\nvielen Dank für deine Bestellung. Deine Rechnung ist bereit.\n\nBetrag: ${data.amount || '0,00'} ${data.currency || 'EUR'}\nFälligkeitsdatum: ${data.dueDate ? new Date(data.dueDate).toLocaleDateString('de-DE') : 'unbekannt'}\n${data.invoiceUrl ? `\nRechnung ansehen: ${data.invoiceUrl}` : ''}`,
      };
    
    default:
      return {
        html: `<p>${data.message || 'E-Mail von MOJO Institut'}</p>`,
        text: data.message || 'E-Mail von MOJO Institut',
      };
  }
}

/**
 * Send email via Resend
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Check if Resend is configured
  if (!resend) {
    appLogger.warn('Resend not configured, email not sent', {
      to: options.to,
      subject: options.subject,
      template: options.template,
    });
    return {
      success: false,
      error: 'Resend not configured',
    };
  }

  // Check user preferences if provided
  if (options.checkPreferences) {
    const { clerkUserId, tenantId, preferenceType } = options.checkPreferences;
    if (clerkUserId && tenantId && preferenceType) {
      // Get user ID from clerkUserId
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true },
      });

      if (user) {
        const shouldSend = await shouldSendEmail(user.id, tenantId, preferenceType);
        if (!shouldSend) {
          appLogger.info('Email skipped due to user preferences', {
            to: options.to,
            template: options.template,
            preferenceType,
            clerkUserId,
            userId: user.id,
          });
          return {
            success: true,
            messageId: 'skipped',
          };
        }
      } else {
        appLogger.warn('User not found for preference check, sending email anyway', {
          clerkUserId,
          to: options.to,
        });
      }
    }
  }

  try {
    const content = getEmailContent(options.template, options.data);
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const result = await resend.emails.send({
      from: options.from || env.EMAIL_FROM || 'MOJO Institut <noreply@mojo-institut.de>',
      to: recipients,
      subject: options.subject,
      html: content.html,
      text: content.text,
      replyTo: options.replyTo,
      tags: options.tags ? options.tags.map(t => typeof t === 'string' ? { name: t, value: t } : t) : undefined,
    });

    appLogger.info('Email sent successfully', {
      to: options.to,
      subject: options.subject,
      template: options.template,
      messageId: result.data?.id,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    appLogger.error('Failed to send email', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      to: options.to,
      subject: options.subject,
      template: options.template,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send tenant invitation email
 */
export async function sendTenantInvitationEmail(options: {
  to: string;
  tenantName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail({
    to: options.to,
    subject: `Einladung zu ${options.tenantName}`,
    template: 'tenant-invitation',
    data: {
      tenantName: options.tenantName,
      inviterName: options.inviterName,
      role: options.role,
      inviteUrl: options.inviteUrl,
      expiresAt: options.expiresAt.toISOString(),
    },
    tags: [{ name: 'tenant-invitation', value: 'tenant-invitation' }],
  });
}

/**
 * Send invoice email
 */
export async function sendInvoiceEmail(options: {
  to: string;
  invoiceNumber: string;
  customerName: string;
  amount: string;
  currency: string;
  dueDate: Date;
  invoiceUrl?: string;
  checkPreferences?: {
    clerkUserId: string;
    tenantId: string;
  };
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail({
    to: options.to,
    subject: `Rechnung ${options.invoiceNumber}`,
    template: 'invoice',
    data: {
      invoiceNumber: options.invoiceNumber,
      customerName: options.customerName,
      amount: options.amount,
      currency: options.currency,
      dueDate: options.dueDate.toISOString(),
      invoiceUrl: options.invoiceUrl,
    },
    checkPreferences: options.checkPreferences ? {
      clerkUserId: options.checkPreferences.clerkUserId,
      tenantId: options.checkPreferences.tenantId,
      preferenceType: 'emailNotifications', // Invoices are always sent (required for billing)
    } : undefined,
    tags: [{ name: 'invoice', value: 'invoice' }, { name: 'billing', value: 'billing' }],
  });
}

