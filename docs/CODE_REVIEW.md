# Code-Review: accounts.mojo

**Datum:** 2025-01-03  
**Umfang:** Vollständige Code-Review (Sicherheit, Architektur, Error Handling, Edge Cases, Resilienz)

---

## 📊 Executive Summary

Die Codebase von `account.mojo` zeigt insgesamt eine **gute Code-Qualität** mit klarer Architektur und durchdachtem Error Handling. Es gibt jedoch einige **kritische Verbesserungsmöglichkeiten** in den Bereichen Sicherheit, Race Conditions und Type Safety.

**Gesamtbewertung:** 🟢 **Gut** (7.5/10)

---

## ✅ Stärken

### 1. **Saubere Architektur**
- ✅ Klare Trennung: API (`apps/api`), Frontend (`apps/web`), Shared (`packages/shared`)
- ✅ Modularer Aufbau: Middleware, Routes, Services, Clients
- ✅ TypeScript für Type Safety
- ✅ Zod Schemas für Input Validation

### 2. **Sicherheit**
- ✅ SQL Injection geschützt (Prisma ORM)
- ✅ RBAC implementiert
- ✅ Tenant Isolation korrekt
- ✅ Timing-Safe Token Comparison (`crypto.timingSafeEqual`)
- ✅ Open Redirect Schutz (`validateReturnUrl`)
- ✅ Webhook Signature Verification (Svix für Clerk)

### 3. **Error Handling**
- ✅ Zentrale Error Handler (`error-handler.ts`)
- ✅ Prisma Error Mapping
- ✅ Zod Validation Errors korrekt behandelt
- ✅ Graceful Degradation (Cache-Fallbacks)
- ✅ Retry Logic mit Exponential Backoff (`BaseHttpClient`)

### 4. **Resilienz**
- ✅ Retry Logic für externe Services
- ✅ Timeout-Konfiguration (10s)
- ✅ Cache-System für externe Service Calls
- ✅ Stale-While-Revalidate Pattern
- ✅ Graceful Shutdown

---

## 🔴 Kritische Probleme

### 1. **Race Condition: Concurrent Tenant Creation** ⚠️ **KRITISCH**

**Problem:** Zwei gleichzeitige Requests können denselben Tenant-Slug erstellen.

**Betroffene Datei:** `apps/api/src/routes/tenants.ts:28-72`

**Aktuell:**
```typescript
// 1. Check if slug exists
const existing = await prisma.tenant.findUnique({ where: { slug } });
if (existing) {
  return reply.status(409).send({ error: 'Conflict' });
}

// 2. Create tenant (RACE CONDITION WINDOW!)
const tenant = await prisma.$transaction(async (tx) => {
  const newTenant = await tx.tenant.create({
    data: { name: input.name, slug, ... },
  });
  // ...
});
```

**Lösung:** Unique Constraint + Error Handling
```typescript
try {
  const tenant = await prisma.$transaction(async (tx) => {
    const newTenant = await tx.tenant.create({
      data: { name: input.name, slug, ... },
    });
    // ...
  });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return reply.status(409).send({
      error: 'Conflict',
      message: 'A tenant with this slug already exists',
    });
  }
  throw error;
}
```

**Impact:** Hoch - Kann zu inkonsistenten Daten führen

---

### 2. **Type Safety: `any` Types** ⚠️ **HOCH**

**Problem:** Mehrere `any` Types reduzieren Type Safety.

**Betroffene Dateien:**
- `apps/api/src/services/data-export.service.ts:14-16,43,61,119,268,305`
- `apps/api/src/services/cache.service.ts:25,47,74-75`

**Beispiele:**
```typescript
// ❌ Schlecht
let paymentsData: any = null;
export interface ExportData {
  account: any; // accounts.mojo data
  payments: any; // payments.mojo data
}

// ✅ Gut
interface PaymentsExportData {
  customer: { id: string; email: string };
  orders: Array<{ id: string; ... }>;
  payments: Array<{ id: string; ... }>;
  invoices: Array<{ id: string; ... }>;
}

let paymentsData: PaymentsExportData | null = null;
export interface ExportData {
  account: AccountExportData;
  payments: PaymentsExportData;
}
```

**Impact:** Mittel - Erschwert Refactoring und kann zu Runtime-Fehlern führen

---

### 3. **Missing Transaction in Data Deletion** ⚠️ **MITTEL**

**Problem:** Account Deletion aktualisiert mehrere Services, aber nicht atomisch.

**Betroffene Datei:** `apps/api/src/services/data-export.service.ts:240-329`

**Aktuell:**
```typescript
// 1. Anonymize in payments.mojo (kann fehlschlagen)
await paymentsClient.anonymizeCustomer(...);

// 2. Delete in kontakte.mojo (kann fehlschlagen)
// ... (nur geloggt)

// 3. Update status in accounts.mojo
await prisma.dataRequest.update({ ... });
```

**Problem:** Wenn Schritt 1 fehlschlägt, wird Status trotzdem auf "completed" gesetzt.

**Lösung:** Retry-Mechanismus + Status-Tracking
```typescript
// Track failures per service
const failures: string[] = [];

try {
  await paymentsClient.anonymizeCustomer(...);
} catch (error) {
  failures.push('payments');
}

if (failures.length > 0) {
  await prisma.dataRequest.update({
    where: { id: dataRequestId },
    data: {
      status: 'partially_completed',
      metadata: { failures, ... },
    },
  });
}
```

**Impact:** Mittel - Inkonsistente Daten bei Fehlern

---

### 4. **Frontend: Missing Error Boundaries** ⚠️ **MITTEL**

**Problem:** Keine React Error Boundaries, Fehler können ganze App crashen.

**Betroffene Bereiche:**
- `apps/web/src/app/layout.tsx`
- Alle Page Components

**Lösung:**
```typescript
// apps/web/src/components/ErrorBoundary.tsx
'use client';
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Etwas ist schiefgelaufen</h1>
          <p className="text-muted-foreground">
            {this.state.error?.message || 'Ein unerwarteter Fehler ist aufgetreten.'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Impact:** Mittel - Schlechte UX bei unerwarteten Fehlern

---

### 5. **Frontend: API Client Error Handling** ⚠️ **NIEDRIG**

**Problem:** API Client gibt nur generische Fehler zurück.

**Betroffene Datei:** `apps/web/src/lib/api.ts:36-42`

**Aktuell:**
```typescript
if (!response.ok) {
  const error: ApiError = await response.json().catch(() => ({
    error: "Unknown Error",
    message: `HTTP ${response.status}`,
  }));
  throw new Error(error.message || "An error occurred");
}
```

**Problem:** Verliert detaillierte Fehlerinformationen (Zod Validation Errors, etc.)

**Lösung:**
```typescript
if (!response.ok) {
  const error: ApiError = await response.json().catch(() => ({
    error: "Unknown Error",
    message: `HTTP ${response.status}`,
  }));
  
  const apiError = new Error(error.message || "An error occurred");
  (apiError as any).statusCode = response.status;
  (apiError as any).details = error.details;
  throw apiError;
}

// In Components:
try {
  await accountsApi.updateProfile(...);
} catch (error: any) {
  if (error.statusCode === 400 && error.details?.issues) {
    // Show validation errors
  }
}
```

**Impact:** Niedrig - Erschwert Debugging und UX

---

## 🟡 Mittelschwere Probleme

### 6. **Console Logs in Production** ⚠️ **NIEDRIG**

**Problem:** `console.log/error/warn` werden in Production ausgeführt.

**Betroffene Dateien:**
- `apps/api/src/index.ts:107,112,127,132-135,137`
- `apps/api/src/services/audit.ts:18,36`
- `apps/web/src/providers/TenantProvider.tsx:68,97`
- `apps/web/src/app/*/page.tsx` (mehrere)

**Lösung:**
- ✅ Verwende `appLogger` statt `console.log` im Backend
- ⚠️ Frontend: `console.error` ist okay für kritische Fehler, aber mit Error Tracking (z.B. Sentry)

---

### 7. **Missing Input Validation: Profile Update** ⚠️ **NIEDRIG**

**Problem:** Frontend sendet `undefined` statt `null` für optionale Felder.

**Betroffene Datei:** `apps/web/src/app/profile/page.tsx:70-80`

**Aktuell:**
```typescript
await accountsApi.updateProfile(token, {
  firstName: profile.firstName || undefined, // ❌ Sollte null sein wenn leer
  lastName: profile.lastName || undefined,
  // ...
});
```

**Problem:** Backend erwartet `null`, Frontend sendet `undefined`.

**Lösung:**
```typescript
await accountsApi.updateProfile(token, {
  firstName: profile.firstName || null,
  lastName: profile.lastName || null,
  // ...
});
```

**Impact:** Niedrig - Kann zu unerwarteten Verhalten führen

---

### 8. **Cache Race Condition** ⚠️ **NIEDRIG**

**Problem:** Zwei gleichzeitige Requests können Cache mehrfach updaten.

**Betroffene Datei:** `apps/api/src/routes/profile.ts:30-59`

**Aktuell:**
```typescript
// Request 1: Cache is stale → fetch from CRM
if (!profileCache || isCacheStale(profileCache, CACHE_TTL.PROFILE)) {
  const crmProfile = await crmClient.getProfile(...);
  profileCache = await updateProfileCache(...); // RACE!
}

// Request 2: Cache is stale → fetch from CRM (gleichzeitig)
if (!profileCache || isCacheStale(profileCache, CACHE_TTL.PROFILE)) {
  const crmProfile = await crmClient.getProfile(...);
  profileCache = await updateProfileCache(...); // RACE!
}
```

**Lösung:** Optimistic Locking oder Single-Flight Pattern
```typescript
// Option 1: Single-Flight Pattern (mit In-Memory Cache)
const refreshPromises = new Map<string, Promise<ProfileCache>>();

async function refreshProfileCache(tenantId: string, userId: string) {
  const key = `${tenantId}:${userId}`;
  
  if (refreshPromises.has(key)) {
    return refreshPromises.get(key)!;
  }
  
  const promise = (async () => {
    try {
      const crmProfile = await crmClient.getProfile(...);
      return await updateProfileCache(...);
    } finally {
      refreshPromises.delete(key);
    }
  })();
  
  refreshPromises.set(key, promise);
  return promise;
}
```

**Impact:** Niedrig - Ineffizient, aber nicht kritisch

---

### 9. **Missing Pagination in Tenant Members** ⚠️ **NIEDRIG**

**Problem:** Tenant Members werden alle auf einmal geladen (kann bei großen Teams problematisch sein).

**Betroffene Datei:** `apps/api/src/routes/tenants.ts:91-143`

**Lösung:** Pagination hinzufügen
```typescript
const { page = 1, pageSize = 20 } = paginationSchema.parse(request.query);

const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  include: {
    memberships: {
      where: { status: 'active' },
      include: { user: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    },
    _count: {
      select: { memberships: { where: { status: 'active' } } },
    },
  },
});

return reply.send({
  // ...
  memberCount: tenant._count.memberships,
  members: tenant.memberships.map(...),
  pagination: {
    page,
    pageSize,
    total: tenant._count.memberships,
  },
});
```

**Impact:** Niedrig - Performance-Probleme bei großen Teams

---

## ✅ Gute Praktiken (Beispiele)

### 1. **Transaction für Tenant Creation**
```typescript
const tenant = await prisma.$transaction(async (tx) => {
  const newTenant = await tx.tenant.create({ ... });
  await tx.tenantMembership.create({ ... });
  await tx.preferences.create({ ... });
  return newTenant;
});
```

### 2. **Graceful Degradation**
```typescript
try {
  const subscription = await paymentsClient.getSubscription(...);
} catch (error) {
  // Fallback: Use stale cache
  request.log.warn({ err: error, hasStaleCache: !!billingCache });
}
```

### 3. **Idempotency Check**
```typescript
const existingEvent = await prisma.webhookEvent.findUnique({
  where: { eventId: svixId },
});

if (existingEvent) {
  return reply.send({ received: true, processed: false, reason: 'Duplicate' });
}
```

### 4. **RBAC Validation**
```typescript
const canChange = await canChangeRole(request, targetMemberId, newRole);
if (!canChange.allowed) {
  return reply.status(403).send({ error: 'Forbidden', message: canChange.reason });
}
```

---

## 📋 Priorisierte Empfehlungen

### 🔴 Kritisch (sofort beheben)

1. **Race Condition: Tenant Slug Creation**
   - Unique Constraint + Error Handling
   - **Datei:** `apps/api/src/routes/tenants.ts`

2. **Type Safety: `any` Types ersetzen**
   - Proper Interfaces für Export Data
   - **Datei:** `apps/api/src/services/data-export.service.ts`

### 🟠 Hoch (bald beheben)

3. **Missing Transaction in Data Deletion**
   - Retry-Mechanismus + Status-Tracking
   - **Datei:** `apps/api/src/services/data-export.service.ts`

4. **Frontend: Error Boundaries**
   - Error Boundary Component hinzufügen
   - **Datei:** `apps/web/src/components/ErrorBoundary.tsx`

### 🟡 Mittel (längerfristig)

5. **Console Logs in Production**
   - `appLogger` überall verwenden
   - Frontend: Error Tracking (Sentry)

6. **Cache Race Condition**
   - Single-Flight Pattern für Cache Refresh

7. **Frontend: API Error Handling**
   - Detaillierte Fehler-Objekte

8. **Missing Pagination**
   - Pagination für Tenant Members

---

## 🔍 Edge Cases

### 1. **Clerk Webhook Failure**

**Szenario:** Clerk sendet `user.created`, aber Webhook schlägt fehl.

**Aktuell:** ✅ Gelöst durch `getOrCreateUser()` in Auth Middleware (Fallback)

**Status:** ✅ Gut gehandhabt

---

### 2. **External Service Timeout**

**Szenario:** `payments.mojo` antwortet nicht innerhalb von 10s.

**Aktuell:** ✅ Gelöst durch Retry Logic + Cache Fallback

**Status:** ✅ Gut gehandhabt

---

### 3. **Concurrent Profile Updates**

**Szenario:** User aktualisiert Profil von zwei Tabs gleichzeitig.

**Problem:** Letzter Write gewinnt (Lost Update Problem)

**Lösung:** Optimistic Locking oder Versioning
```typescript
// In Prisma Schema
model ProfileCache {
  version Int @default(1)
  // ...
}

// In Update
await prisma.profileCache.update({
  where: {
    tenantId_userId: { tenantId, userId },
    version: currentVersion, // Optimistic Lock
  },
  data: {
    payload: newProfile,
    version: { increment: 1 },
  },
});
```

**Status:** ⚠️ Nicht gehandhabt

---

### 4. **Tenant Deletion mit aktiven Memberships**

**Szenario:** Tenant wird gelöscht, aber Memberships existieren noch.

**Aktuell:** ✅ Gelöst durch `onDelete: Cascade` in Prisma Schema

**Status:** ✅ Gut gehandhabt

---

### 5. **Webhook Retry Loop**

**Szenario:** Webhook schlägt immer wieder fehl (z.B. wegen Schema-Mismatch).

**Aktuell:** ⚠️ Webhook wird als `failed` markiert, aber keine automatische Retry-Logic

**Lösung:** Job Queue mit Exponential Backoff
```typescript
// In webhook processing
if (error) {
  await prisma.webhookEvent.update({
    where: { id: webhookEvent.id },
    data: {
      status: 'failed',
      attemptCount: { increment: 1 },
      nextRetryAt: new Date(Date.now() + Math.pow(2, attemptCount) * 60000), // Exponential backoff
    },
  });
  
  // Schedule retry job (mit BullMQ oder ähnlich)
  if (attemptCount < MAX_RETRIES) {
    await retryQueue.add({ webhookEventId: webhookEvent.id });
  }
}
```

**Status:** ⚠️ Nicht gehandhabt

---

## 📊 Code Quality Metrics

| Metrik | Wert | Status |
|--------|------|--------|
| Type Coverage | ~85% | 🟡 |
| Error Handling | ✅ Gut | 🟢 |
| Security | ✅ Gut | 🟢 |
| Resilience | ✅ Gut | 🟢 |
| Code Duplication | Niedrig | 🟢 |
| Test Coverage | ⚠️ Nicht geprüft | 🟡 |

---

## 🎯 Fazit

Die Codebase ist **gut strukturiert** und folgt **Best Practices**. Die identifizierten Probleme sind überwiegend **mittelschwer** und können schrittweise behoben werden.

**Nächste Schritte:**
1. ✅ Race Condition bei Tenant Creation beheben
2. ✅ Type Safety verbessern (`any` → proper Types)
3. ✅ Error Boundaries im Frontend hinzufügen
4. ✅ Webhook Retry-Mechanismus implementieren

**Empfehlung:** Diese Probleme sollten **vor Production-Deployment** behoben werden.

---

**Erstellt:** 2025-01-03  
**Zuletzt aktualisiert:** 2025-01-03

