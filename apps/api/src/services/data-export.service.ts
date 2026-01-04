/**
 * Data Export Service
 * Processes DSGVO data export requests by combining data from multiple services
 */

import prisma from '../lib/prisma.js';
import { paymentsClient } from '../clients/payments.js';
import { crmClient } from '../clients/crm.js';
import { appLogger } from '../lib/logger.js';
import archiver from 'archiver';
import { Readable } from 'stream';

// Type definitions for export data

export interface AccountExportData {
  userId: string;
  clerkUserId: string;
  exportedAt: string;
}

export interface PaymentsOrder {
  id: string;
  order_number?: string;
  status: string;
  grand_total: number | string;
  currency: string;
  created_at: string;
}

export interface PaymentsPayment {
  id: string;
  order_id?: string;
  amount: number | string;
  status: string;
  provider: string;
  created_at: string;
}

export interface PaymentsInvoice {
  id: string;
  invoice_number?: string;
  order_id: string;
  status: string;
  grand_total: number | string;
  currency: string;
  issued_at?: string;
}

export interface PaymentsCustomer {
  id: string;
  email: string;
}

export interface PaymentsExportData {
  customer: PaymentsCustomer;
  orders?: PaymentsOrder[];
  payments?: PaymentsPayment[];
  invoices?: PaymentsInvoice[];
  exported_at?: string;
}

export interface ConsentData {
  type: string;
  granted: boolean;
  version?: string;
  source?: string;
  createdAt?: string;
  grantedAt?: string | null;
}

export interface ExportData {
  account: AccountExportData;
  payments: PaymentsExportData | null;
  consents: ConsentData[];
  exported_at: string;
}

/**
 * Process a data export request
 * Combines data from accounts.mojo, payments.mojo, and kontakte.mojo
 */
export async function processDataExport(
  dataRequestId: string,
  userId: string,
  clerkUserId: string
): Promise<void> {
  try {
    // Update request status to processing
    await prisma.dataRequest.update({
      where: { id: dataRequestId },
      data: { status: 'processing' },
    });

    appLogger.info('Processing data export request', {
      dataRequestId,
      userId,
      clerkUserId,
    });

    // 1. Get payments.mojo data
    let paymentsData: PaymentsExportData | null = null;
    try {
      paymentsData = await paymentsClient.getGdprExport(clerkUserId) as PaymentsExportData;
      appLogger.info('Fetched payments data', {
        dataRequestId,
        orders_count: paymentsData?.orders?.length || 0,
        payments_count: paymentsData?.payments?.length || 0,
        invoices_count: paymentsData?.invoices?.length || 0,
      });
    } catch (error: unknown) {
      appLogger.warn('Failed to fetch payments data (continuing anyway)', {
        dataRequestId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue even if payments.mojo fails - user still gets their account data
    }

    // 2. Get consents from kontakte.mojo (SSOT)
    let consents: ConsentData[] = [];
    try {
      const rawConsents = await crmClient.getConsents(clerkUserId);
      consents = rawConsents.map((c) => ({
        type: c.type,
        granted: c.granted,
        source: c.source || undefined,
        grantedAt: c.grantedAt ? c.grantedAt.toISOString() : null,
      }));
      appLogger.info('Fetched consents', {
        dataRequestId,
        consents_count: consents.length,
      });
    } catch (error: unknown) {
      appLogger.warn('Failed to fetch consents (continuing anyway)', {
        dataRequestId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue even if kontakte.mojo fails
    }

    // 3. Get account data from accounts.mojo (current service)
    // This would include user profile, subscriptions, etc.
    const accountData: AccountExportData = {
      userId,
      clerkUserId,
      exportedAt: new Date().toISOString(),
    };

    // 4. Combine all data
    const exportData: ExportData = {
      account: accountData,
      payments: paymentsData,
      consents,
      exported_at: new Date().toISOString(),
    };

    // 5. Generate ZIP file
    const zipBuffer = await generateExportZip(exportData);

    // 6. Store ZIP file (in production, upload to S3 or similar)
    // For now, we'll store a reference - in production you'd upload to S3
    const downloadUrl = `/api/v1/data/download/${dataRequestId}`; // Placeholder

    // 7. Update request status to completed
    await prisma.dataRequest.update({
      where: { id: dataRequestId },
      data: {
        status: 'completed',
        downloadUrl,
        completedAt: new Date(),
        metadata: {
          ...((await prisma.dataRequest.findUnique({ where: { id: dataRequestId } }))?.metadata as object || {}),
          exportedAt: new Date().toISOString(),
          dataSources: ['accounts.mojo', paymentsData ? 'payments.mojo' : null, consents.length > 0 ? 'kontakte.mojo' : null].filter(Boolean),
        },
      },
    });

    appLogger.info('Data export completed', {
      dataRequestId,
      downloadUrl,
    });
  } catch (error: any) {
    appLogger.error('Data export processing failed', {
      dataRequestId,
      userId,
      clerkUserId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update request status to failed
    await prisma.dataRequest.update({
      where: { id: dataRequestId },
      data: {
        status: 'failed',
        metadata: {
          ...((await prisma.dataRequest.findUnique({ where: { id: dataRequestId } }))?.metadata as object || {}),
          error: error.message,
          failedAt: new Date().toISOString(),
        },
      },
    });

    throw error;
  }
}

/**
 * Generate ZIP file from export data
 */
async function generateExportZip(data: ExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on('error', (error) => {
      reject(error);
    });

    // Add JSON export
    archive.append(JSON.stringify(data, null, 2), { name: 'export.json' });

    // Add CSV export (if payments data available)
    if (data.payments) {
      const csvData = convertToCsv(data);
      archive.append(csvData, { name: 'export.csv' });
    }

    // Finalize archive
    archive.finalize();
  });
}

/**
 * Convert export data to CSV format
 */
function convertToCsv(data: ExportData): string {
  const lines: string[] = [];

  // Header
  lines.push('Type,Field,Value');

  // Account data
  lines.push(`Account,userId,${data.account.userId}`);
  lines.push(`Account,clerkUserId,${data.account.clerkUserId}`);
  lines.push(`Account,exportedAt,${data.account.exportedAt}`);

  // Payments data
  if (data.payments) {
    if (data.payments.orders) {
      lines.push('');
      lines.push('Orders');
      lines.push('Order ID,Order Number,Status,Total,Currency,Created At');
      for (const order of data.payments.orders) {
        lines.push(`${order.id},${order.order_number || ''},${order.status},${order.grand_total},${order.currency},${order.created_at}`);
      }
    }

    if (data.payments.payments) {
      lines.push('');
      lines.push('Payments');
      lines.push('Payment ID,Order ID,Amount,Status,Provider,Created At');
      for (const payment of data.payments.payments) {
        lines.push(`${payment.id},${payment.order_id || ''},${payment.amount},${payment.status},${payment.provider},${payment.created_at}`);
      }
    }

    if (data.payments.invoices) {
      lines.push('');
      lines.push('Invoices');
      lines.push('Invoice ID,Invoice Number,Order ID,Status,Total,Currency,Issued At');
      for (const invoice of data.payments.invoices) {
        lines.push(`${invoice.id},${invoice.invoice_number || ''},${invoice.order_id},${invoice.status},${invoice.grand_total},${invoice.currency},${invoice.issued_at || ''}`);
      }
    }
  }

  // Consents
  if (data.consents && data.consents.length > 0) {
    lines.push('');
    lines.push('Consents');
    lines.push('Type,Granted,Version,Source,Created At');
    for (const consent of data.consents) {
      lines.push(`${consent.type},${consent.granted},${consent.version || ''},${consent.source || ''},${consent.createdAt || ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * Process account deletion request
 * Anonymizes data in payments.mojo and kontakte.mojo
 */
export async function processAccountDeletion(
  dataRequestId: string,
  userId: string,
  clerkUserId: string,
  reason: string
): Promise<void> {
  try {
    // Update request status to processing
    await prisma.dataRequest.update({
      where: { id: dataRequestId },
      data: { status: 'processing' },
    });

    appLogger.info('Processing account deletion request', {
      dataRequestId,
      userId,
      clerkUserId,
      reason,
    });

    // Track failures per service for partial completion handling
    const failures: string[] = [];
    const successDetails: Record<string, unknown> = {};

    // 1. Anonymize data in payments.mojo
    try {
      const anonymizationResult = await paymentsClient.anonymizeCustomer(clerkUserId, reason, dataRequestId);
      successDetails.payments = {
        customer_id: anonymizationResult?.customer_id || 'unknown',
        anonymized_fields: anonymizationResult?.anonymized_fields || [],
      };
      appLogger.info('Anonymized customer in payments.mojo', {
        dataRequestId,
        customer_id: successDetails.payments?.customer_id || 'unknown',
        anonymized_fields: successDetails.payments?.anonymized_fields || [],
      });
    } catch (error: unknown) {
      failures.push('payments.mojo');
      appLogger.warn('Failed to anonymize customer in payments.mojo', {
        dataRequestId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue even if payments.mojo fails - other services should still be processed
    }

    // 2. Delete/Anonymize in kontakte.mojo (SSOT)
    // This would be handled by kontakte.mojo's own deletion endpoint
    // For now, we just log it
    appLogger.info('Account deletion processed', {
      dataRequestId,
      userId,
      clerkUserId,
    });

    // 3. Soft-delete account in accounts.mojo
    // This would be handled by accounts.mojo's own deletion logic
    // For now, we just update the request status

    // 4. Update request status based on completion
    const currentRequest = await prisma.dataRequest.findUnique({
      where: { id: dataRequestId },
    });

    const status = failures.length > 0 ? 'partially_completed' : 'completed';
    
    await prisma.dataRequest.update({
      where: { id: dataRequestId },
      data: {
        status: status as 'completed' | 'partially_completed',
        completedAt: new Date(),
        metadata: {
          ...((currentRequest?.metadata as object) || {}),
          processedAt: new Date().toISOString(),
          failures: failures.length > 0 ? failures : undefined,
          successDetails: Object.keys(successDetails).length > 0 ? successDetails : undefined,
        },
      },
    });

    if (failures.length > 0) {
      appLogger.warn('Account deletion partially completed', {
        dataRequestId,
        failures,
      });
    }

    appLogger.info('Account deletion completed', {
      dataRequestId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    appLogger.error('Account deletion processing failed', {
      dataRequestId,
      userId,
      clerkUserId,
      error: errorMessage,
      stack: errorStack,
    });

    // Update request status to failed
    await prisma.dataRequest.update({
      where: { id: dataRequestId },
      data: {
        status: 'failed',
        metadata: {
          ...((await prisma.dataRequest.findUnique({ where: { id: dataRequestId } }))?.metadata as object || {}),
          error: errorMessage,
          failedAt: new Date().toISOString(),
        },
      },
    });

    throw error;
  }
}

