# Software Audit - accounts.mojo v0.3.0

**Datum:** 2024-12-29  
**Geprüfte Aspekte:** Konsistenz, Resilienz, Unnötige Komplexität

---

## 🔍 Zusammenfassung

Dieses Audit identifiziert Verbesserungspotenziale in drei kritischen Bereichen:

- **Konsistenz**: Code-Patterns, Namenskonventionen, Logging
- **Resilienz**: Error Handling, Retry-Logik, Timeouts, Fallbacks
- **Komplexität**: Duplikationen, unnötige Abstraktionen, vereinfachbare Strukturen

---

## 1. Konsistenz-Probleme

### 1.1 Logging-Inkonsistenz ⚠️ **Hoch**

**Problem:** Mix aus `console.log/error/warn` und strukturiertem Logging

**Betroffene Dateien:**
- `apps/api/src/clients/crm.ts` - 6x `console.error/log`
- `apps/api/src/clients/payments.ts` - 8x `console.error/log`
- `apps/api/src/routes/clerk-webhooks.ts` - 15+ `console.log/error/warn`
- `apps/api/src/services/data-export.service.ts` - eigener Logger
- `apps/api/src/middleware/auth.ts` - `console.log/warn/error`

**Aktuell:**
```typescript
// In Clients
console.error('Failed to fetch subscription:', error);

// In Routes
request.log.error({ err: error, ... });

// In Services
const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
};
```

**Empfehlung:**
- Strukturiertes Logging durchgängig verwenden
- Fastify's `request.log` oder zentraler Logger (z.B. Pino)
- `console.*` nur für Startup/Initialisierung

**Impact:** Hoch - erschwert Monitoring und Debugging

---

### 1.2 TENANT_HEADERS Duplikation 🔄 **Mittel**

**Problem:** `TENANT_HEADERS` wird in 3 Dateien definiert

**Betroffene Dateien:**
- `apps/api/src/clients/crm.ts` (Zeile 5-9)
- `apps/api/src/clients/payments.ts` (Zeile 5-9)
- `apps/api/src/middleware/auth.ts` (Zeile 32-36)

**Aktuell:**
```typescript
// In jeder Datei:
const TENANT_HEADERS = {
  TENANT_ID: 'x-tenant-id',
  TENANT_SLUG: 'x-tenant-slug',
  SERVICE_NAME: 'x-service-name',
} as const;
```

**Empfehlung:**
- Zentrale Definition in `apps/api/src/lib/constants.ts` oder
- Verwendung des `@mojo/tenant` Packages (falls verfügbar)
- Export und Import statt Duplikation

**Impact:** Mittel - erhöht Wartbarkeit, reduziert Risiko von Inkonsistenzen

---

### 1.3 Error-Handling Inkonsistenz ⚠️ **Hoch**

**Problem:** Unterschiedliche Patterns für Error Handling

**In Clients:**
```typescript
// crm.ts / payments.ts
try {
  return await this.fetch(...);
} catch (error) {
  console.error('Failed...', error);
  return null; // ❌ Silent failure
}
```

**In Routes:**
```typescript
// Manche werfen Errors weiter
throw error;

// Manche loggen nur
request.log.error({ err: error });
```

**Empfehlung:**
- Klare Strategie: Wann `return null`, wann `throw`?
- Typisierte Errors (z.B. `ServiceUnavailableError`, `NotFoundError`)
- Konsequente Behandlung in allen Clients

**Impact:** Hoch - erschwert Fehlerbehandlung und Debugging

---

### 1.4 Cache-Refresh-Logik Duplikation 🔄 **Mittel**

**Problem:** Ähnliche Cache-Refresh-Logik in 3 Routes

**Betroffene Dateien:**
- `apps/api/src/routes/profile.ts` (Zeile 29-31)
- `apps/api/src/routes/billing.ts` (Zeile 30-31, 85-86)
- `apps/api/src/routes/entitlements.ts` (Zeile 29-30)

**Aktuell:**
```typescript
// Wiederholt in jeder Route:
const cacheAge = cache ? Date.now() - cache.updatedAt.getTime() : Infinity;
const cacheStale = cacheAge > 5 * 60 * 1000; // oder 60 * 1000
```

**Empfehlung:**
- Utility-Funktion: `isCacheStale(cache: Cache, ttlMs: number): boolean`
- Oder Service-Klasse für Cache-Management

**Impact:** Mittel - reduziert Duplikation, erleichtert zukünftige Änderungen

---

## 2. Resilienz-Probleme

### 2.1 Keine Retry-Logik für externe Services ❌ **Kritisch**

**Problem:** Externe API-Calls haben keine Retry-Mechanismen

**Betroffene Dateien:**
- `apps/api/src/clients/crm.ts` - `fetch()` Methoden
- `apps/api/src/clients/payments.ts` - `fetch()` Methoden

**Aktuell:**
```typescript
private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(...);
  if (!response.ok) {
    throw new Error(...);
  }
  return response.json();
}
```

**Empfehlung:**
- Exponential Backoff mit Retry (z.B. 3 Versuche)
- Nur für transient errors (5xx, Network errors)
- Configurable: `maxRetries`, `initialDelayMs`

**Beispiel:**
```typescript
private async fetchWithRetry<T>(
  endpoint: string, 
  options: RequestInit = {},
  retries = 3
): Promise<T> {
  try {
    const response = await fetch(...);
    if (!response.ok) {
      if (response.status >= 500 && retries > 0) {
        await delay(Math.pow(2, 3 - retries) * 1000);
        return this.fetchWithRetry(endpoint, options, retries - 1);
      }
      throw new Error(...);
    }
    return response.json();
  } catch (error) {
    if (retries > 0 && isNetworkError(error)) {
      await delay(Math.pow(2, 3 - retries) * 1000);
      return this.fetchWithRetry(endpoint, options, retries - 1);
    }
    throw error;
  }
}
```

**Impact:** Kritisch - erhöht Robustheit bei transienten Netzwerk-Fehlern

---

### 2.2 Keine Timeouts für HTTP-Requests ⏱️ **Hoch**

**Problem:** Fetch-Requests haben keine Timeout-Logik

**Aktuell:**
```typescript
const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
  ...options,
  headers: {...},
});
```

**Empfehlung:**
- Timeout-Wrapper oder `AbortController` mit Timeout
- Default: 10-30 Sekunden
- Configurable pro Client

**Beispiel:**
```typescript
private async fetchWithTimeout<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(endpoint, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}
```

**Impact:** Hoch - verhindert hängende Requests

---

### 2.3 Keine Circuit Breaker Pattern 🔴 **Mittel**

**Problem:** Bei wiederholten Fehlern wird weiterhin versucht, externe Services zu erreichen

**Empfehlung:**
- Circuit Breaker Pattern implementieren
- Öffnet bei zu vielen Fehlern, blockiert Requests temporär
- Auto-Reset nach kurzer Zeit

**Beispiel:**
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > 60000) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

**Impact:** Mittel - schützt vor Cascading Failures

---

### 2.4 Fehlende Fallback-Strategien 🔄 **Hoch**

**Problem:** Bei Fehlern von externen Services wird oft `null` zurückgegeben ohne Fallback

**Beispiel aus `crm.ts`:**
```typescript
async getProfile(clerkUserId: string): Promise<Profile | null> {
  try {
    return await this.fetch<Profile>(...);
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return null; // ❌ Kein Fallback auf Cache
  }
}
```

**Empfehlung:**
- Fallback auf Stale Cache wenn verfügbar
- Graceful Degradation (z.B. Cache statt null)
- Partielle Antworten wenn möglich

**Impact:** Hoch - verbessert User Experience bei Service-Ausfällen

---

### 2.5 Webhook-Error-Handling unvollständig ⚠️ **Mittel**

**Problem:** Webhook-Fehler werden geloggt, aber nicht retried

**Betroffene Dateien:**
- `apps/api/src/routes/clerk-webhooks.ts`
- `apps/api/src/routes/webhooks.ts`

**Aktuell:**
```typescript
catch (error) {
  console.error(`❌ Error processing webhook ${event.type}:`, error);
  await prisma.webhookEvent.update({
    where: { id: webhookEvent.id },
    data: { status: 'failed', ... },
  });
  return reply.status(500).send({ error: '...' });
}
```

**Empfehlung:**
- Dead Letter Queue für fehlgeschlagene Webhooks
- Retry-Mechanismus mit Exponential Backoff
- Alerting bei zu vielen Fehlern

**Impact:** Mittel - verbessert Zuverlässigkeit der Webhook-Verarbeitung

---

## 3. Unnötige Komplexität

### 3.1 Mock-Mode Duplikation 🔄 **Niedrig**

**Problem:** Mock-Mode-Logik wird in jedem Client wiederholt

**Betroffene Dateien:**
- `apps/api/src/clients/crm.ts`
- `apps/api/src/clients/payments.ts`

**Aktuell:**
```typescript
// In jedem Client:
constructor() {
  this.mockMode = env.MOCK_EXTERNAL_SERVICES || !this.config.apiKey;
  if (this.mockMode) {
    console.log('📦 Client running in mock mode');
  }
}

// In jeder Methode:
if (this.mockMode) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return mockData;
}
```

**Empfehlung:**
- Base Client-Klasse mit Mock-Funktionalität
- Mock-Provider Interface
- Zentrale Mock-Daten

**Impact:** Niedrig - reduziert Code-Duplikation

---

### 3.2 Caching-Logik könnte zentralisiert werden 🔄 **Mittel**

**Problem:** Cache-Upsert-Logik wiederholt sich

**Betroffene Dateien:**
- `apps/api/src/routes/profile.ts`
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/entitlements.ts`

**Aktuell:**
```typescript
// Wiederholt in jeder Route:
cache = await prisma.xxxCache.upsert({
  where: { tenantId_userId: {...} },
  create: { tenantId, userId, payload },
  update: { payload },
});
```

**Empfehlung:**
- Service-Klasse: `CacheService.updateCache<T>(type, tenantId, userId, data, ttl)`
- Generisch für alle Cache-Typen

**Impact:** Mittel - reduziert Duplikation, erleichtert zukünftige Änderungen

---

### 3.3 Frontend API Client: Lange inline Types 📝 **Niedrig**

**Problem:** Sehr lange inline Type-Definitionen in `apps/web/src/lib/api.ts`

**Aktuell:**
```typescript
getMe: (token: string) => api.get<{
  user: {
    id: string;
    clerkUserId: string;
    // ... 20+ weitere Zeilen
  };
  // ...
}>("/api/v1/me", token),
```

**Empfehlung:**
- Types in separate Datei auslagern
- `apps/web/src/types/api.ts` oder ähnlich
- Verwendung von Shared Types wo möglich

**Impact:** Niedrig - verbessert Lesbarkeit und Wartbarkeit

---

### 3.4 Error-Handler: Weitere Verbesserungen möglich 💡 **Niedrig**

**Status:** Error-Handler funktioniert korrekt, aber könnte erweitert werden

**Mögliche Verbesserungen:**
- Rate-Limit-Errors (429) explizit behandeln
- Timeout-Errors explizit behandeln
- Metrics/Tracking für Error-Typen
- Sentry/Error-Tracking Integration

---

## 📊 Priorisierte Empfehlungen

### 🔴 Kritisch (sofort beheben)

1. **Retry-Logik für externe Services hinzufügen**
   - Erhöht Robustheit erheblich
   - Reduziert Fehlerrate bei transienten Problemen

### 🟠 Hoch (bald beheben)

3. **Strukturiertes Logging durchgängig verwenden**
   - Verbessert Monitoring und Debugging
   - Konsistenz über Codebase

4. **Timeouts für HTTP-Requests hinzufügen**
   - Verhindert hängende Requests
   - Verbessert Timeout-Handling

5. **Fallback-Strategien implementieren**
   - Graceful Degradation
   - Bessere User Experience bei Service-Ausfällen

### 🟡 Mittel (längerfristig)

6. **TENANT_HEADERS zentralisieren**
7. **Cache-Logik zentralisieren**
8. **Circuit Breaker Pattern**
9. **Webhook Retry-Mechanismus**

### 🟢 Niedrig (optional)

10. **Mock-Mode in Base-Klasse**
11. **Frontend Types auslagern**

---

## 🛠️ Konkrete Verbesserungsvorschläge

### Vorschlag 1: HTTP Client Base-Klasse

```typescript
// apps/api/src/lib/http-client.ts
export abstract class BaseHttpClient {
  protected config: {
    baseUrl: string;
    apiKey: string;
    timeout?: number;
    maxRetries?: number;
  };
  
  protected mockMode: boolean;
  
  constructor(config: {...}) {
    this.config = { timeout: 10000, maxRetries: 3, ...config };
    this.mockMode = env.MOCK_EXTERNAL_SERVICES || !config.apiKey;
  }
  
  protected async fetchWithRetryAndTimeout<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Implementierung mit Retry + Timeout
  }
}
```

### Vorschlag 2: Cache Service

```typescript
// apps/api/src/services/cache.service.ts
export class CacheService {
  static isStale<T extends { updatedAt: Date }>(
    cache: T | null,
    ttlMs: number
  ): boolean {
    if (!cache) return true;
    return Date.now() - cache.updatedAt.getTime() > ttlMs;
  }
  
  static async updateCache<T>(
    model: any,
    where: { tenantId: string; userId: string },
    data: T
  ) {
    return model.upsert({
      where,
      create: { ...where, payload: data },
      update: { payload: data },
    });
  }
}
```

### Vorschlag 3: Zentrale Constants

```typescript
// apps/api/src/lib/constants.ts
export const TENANT_HEADERS = {
  TENANT_ID: 'x-tenant-id',
  TENANT_SLUG: 'x-tenant-slug',
  SERVICE_NAME: 'x-service-name',
} as const;

export const CACHE_TTL = {
  PROFILE: 5 * 60 * 1000, // 5 Minuten
  BILLING: 60 * 1000,     // 1 Minute
  ENTITLEMENTS: 5 * 60 * 1000, // 5 Minuten
} as const;
```

---

## 📝 Checkliste für Implementierung

### Phase 1: Kritische Fixes
- [ ] Retry-Logik für externe Services
- [ ] Timeouts für HTTP-Requests
- [ ] Fallback-Strategien implementieren

### Phase 2: Verbesserungen
- [ ] Strukturiertes Logging durchgängig
- [ ] Fallback-Strategien
- [ ] TENANT_HEADERS zentralisieren

### Phase 3: Refactoring
- [ ] Cache Service
- [ ] Circuit Breaker (optional)
- [ ] Base HTTP Client

---

**Erstellt:** 2024-12-29  
**Version:** 1.0

