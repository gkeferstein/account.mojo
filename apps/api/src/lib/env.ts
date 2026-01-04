import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from project root and apps/api
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load from project root first
// From apps/api/src/lib/env.ts: ../../../../.env goes to project root
const rootEnvPath = resolve(__dirname, '../../../../.env');
const apiEnvPath = resolve(__dirname, '../../.env');
const rootResult = config({ path: rootEnvPath });
const apiResult = config({ path: apiEnvPath });
// Merge parsed results into process.env if not already set
if (rootResult.parsed) {
  Object.assign(process.env, rootResult.parsed);
}
if (apiResult.parsed) {
  Object.assign(process.env, apiResult.parsed);
}
// Debug: Log if env files were found (only in development)
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  console.error('[env.ts] Root .env loaded:', rootResult.parsed ? 'YES' : 'NO');
  console.error('[env.ts] API .env loaded:', apiResult.parsed ? 'YES' : 'NO');
  console.error('[env.ts] CLERK_SECRET_KEY in process.env:', !!process.env.CLERK_SECRET_KEY);
  console.error('[env.ts] CLERK_SECRET_KEY in rootResult.parsed:', !!rootResult.parsed?.CLERK_SECRET_KEY);
  console.error('[env.ts] rootResult.parsed keys:', rootResult.parsed ? Object.keys(rootResult.parsed).join(', ') : 'none');
}

export const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3005', 10),
  HOST: process.env.HOST || '0.0.0.0',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://accounts:accounts_secret@localhost:5436/accounts_db',
  
  // Clerk
  // Use parsed result directly if process.env doesn't have it
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || rootResult.parsed?.CLERK_SECRET_KEY || apiResult.parsed?.CLERK_SECRET_KEY || '',
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || '',
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET || '',
  
  // External Services
  PAYMENTS_API_URL: process.env.PAYMENTS_API_URL || 'https://payments.mojo-institut.de/api/v1',
  PAYMENTS_API_KEY: process.env.PAYMENTS_API_KEY || '',
  CRM_API_URL: process.env.CRM_API_URL || 'https://kontakte.mojo-institut.de/api/v1',
  CRM_API_KEY: process.env.CRM_API_KEY || '',
  CRM_TENANT_SLUG: process.env.CRM_TENANT_SLUG || 'mojo',
  
  // Webhooks
  WEBHOOK_SECRET_PAYMENTS: process.env.WEBHOOK_SECRET_PAYMENTS || 'dev-webhook-secret-payments',
  WEBHOOK_SECRET_CRM: process.env.WEBHOOK_SECRET_CRM || 'dev-webhook-secret-crm',
  
  // Internal API (Service-to-Service)
  INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || 'dev-internal-api-secret',
  
  // Mock Mode (for local development)
  MOCK_EXTERNAL_SERVICES: process.env.MOCK_EXTERNAL_SERVICES === 'true',
  
  // Frontend URL (for CORS)
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3004',
  
  // Email (Resend - centralized email service for all MOJO apps)
  EMAIL_FROM: process.env.EMAIL_FROM || 'MOJO Institut <noreply@mojo-institut.de>',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  // Legacy SendGrid (deprecated, use Resend instead)
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
};

export function validateEnv(): void {
  const required: (keyof typeof env)[] = ['DATABASE_URL'];
  
  // ALWAYS validate Clerk keys are not placeholders (this was causing 401 errors!)
  const clerkSecretKey = env.CLERK_SECRET_KEY;
  if (clerkSecretKey.includes('xxxx') || clerkSecretKey === 'sk_test_xxxx') {
    console.error('\n' + '='.repeat(70));
    console.error('❌ CLERK_SECRET_KEY ist ein Platzhalter-Wert!');
    console.error('');
    console.error('   Die API kann JWT-Tokens nicht verifizieren.');
    console.error('   Das führt zu 401 Unauthorized Fehlern.');
    console.error('');
    console.error('   Lösung:');
    console.error('   1. Führe aus: ./scripts/setup-env.sh');
    console.error('   2. Oder kopiere den echten Key von apps/web/.env.local in .env');
    console.error('='.repeat(70) + '\n');
    throw new Error('CLERK_SECRET_KEY has placeholder value - API cannot verify tokens!');
  }
  
  // Validate Clerk key format
  if (clerkSecretKey && !clerkSecretKey.startsWith('sk_test_') && !clerkSecretKey.startsWith('sk_live_')) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ CLERK_SECRET_KEY hat ein ungültiges Format!');
    console.error('   Erwartet: sk_test_... oder sk_live_...');
    console.error('   Erhalten: ' + clerkSecretKey.substring(0, 20) + '...');
    console.error('='.repeat(70) + '\n');
    throw new Error('CLERK_SECRET_KEY has invalid format');
  }
  
  // In production, require Clerk keys and validate configuration
  if (env.NODE_ENV === 'production') {
    required.push('CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY');
    
    // Warn if mock mode is enabled in production
    if (env.MOCK_EXTERNAL_SERVICES) {
      throw new Error('MOCK_EXTERNAL_SERVICES must be false in production');
    }
    
    // Warn if dev defaults are used
    if (env.WEBHOOK_SECRET_PAYMENTS === 'dev-webhook-secret-payments') {
      throw new Error('WEBHOOK_SECRET_PAYMENTS must not use dev default in production');
    }
    if (env.WEBHOOK_SECRET_CRM === 'dev-webhook-secret-crm') {
      throw new Error('WEBHOOK_SECRET_CRM must not use dev default in production');
    }
    if (env.INTERNAL_API_SECRET === 'dev-internal-api-secret') {
      throw new Error('INTERNAL_API_SECRET must not use dev default in production');
    }
    
    // Warn if test keys are used
    if (env.CLERK_SECRET_KEY.startsWith('sk_test_')) {
      throw new Error('CLERK_SECRET_KEY must be a LIVE key (sk_live_...) in production');
    }
    if (env.CLERK_PUBLISHABLE_KEY.startsWith('pk_test_')) {
      throw new Error('CLERK_PUBLISHABLE_KEY must be a LIVE key (pk_live_...) in production');
    }
  }
  
  const missing = required.filter((key) => !env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default env;

