# Security Audit - accounts.mojo v0.3.0

**Datum:** 2024-12-29  
**Geprüfte Aspekte:** Authentifizierung, Autorisierung, Input Validation, Secrets Management, Tenant Isolation, Webhook Security

---

## 🔒 Zusammenfassung

Dieses Security Audit identifiziert Sicherheitsprobleme und -schwächen in der accounts.mojo Anwendung. Die meisten Bereiche sind gut geschützt, aber es gibt einige kritische und mittelschwere Probleme, die behoben werden sollten.

---

## 🔴 Kritische Sicherheitsprobleme

### 1. Webhook Signature Verification: Unsichere Body-Serialisierung ❌ **KRITISCH**

**Problem:** Webhook-Signatur wird gegen `JSON.stringify(request.body)` verifiziert, aber der Body wurde bereits geparst.

**Betroffene Datei:** `apps/api/src/routes/webhooks.ts:34`

**Aktuell:**
```typescript
async function verifyWebhookSignature(secret: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['x-webhook-signature'] as string;
    const rawBody = JSON.stringify(request.body); // ❌ Body wurde bereits geparst!
    
    if (!verifySignature(rawBody, signature, secret)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  };
}
```

**Problem:**
- Fastify parst JSON automatisch, bevor der Handler aufgerufen wird
- `JSON.stringify()` kann andere Reihenfolge/Formatierung haben als Original
- Signature Verification schlägt fehl oder ist anfällig für Replay-Angriffe

**Empfehlung:**
- Raw Body als Buffer/String vor dem Parsing erhalten
- Content-Type Parser für `application/json` mit `parseAs: 'string'` verwenden
- Signature gegen den rohen Body-String verifizieren

**Impact:** Kritisch - Webhooks könnten ohne gültige Signatur akzeptiert werden

---

### 2. Weak Internal API Authentication 🔑 **HOCH**

**Problem:** Internal API verwendet einfachen Token-Vergleich ohne Timing-Safe-Comparison

**Betroffene Datei:** `apps/api/src/routes/internal.ts:16`

**Aktuell:**
```typescript
if (token !== env.INTERNAL_API_SECRET) {
  return reply.status(401).send({ error: 'Unauthorized' });
}
```

**Problem:**
- Timing-Attack möglich (String-Vergleich ist nicht constant-time)
- Einfacher Token ohne weitere Sicherheitsmaßnahmen

**Empfehlung:**
- `crypto.timingSafeEqual()` verwenden
- Oder HMAC-basierte Token verwenden

**Impact:** Hoch - Timing-Attacks könnten Secrets extrahieren

---

### 3. Missing Input Validation für Consents ⚠️ **HOCH**

**Problem:** Consents werden ohne Schema-Validation akzeptiert

**Betroffene Datei:** `apps/api/src/routes/profile.ts:160`

**Aktuell:**
```typescript
const { consents } = request.body as { consents: Array<{ type: string; granted: boolean }> };
```

**Problem:**
- Keine Zod-Validation
- Type-Casting statt Validierung
- Mögliche Injection oder falsche Daten

**Empfehlung:**
- Zod Schema für Consents erstellen
- Validation vor Verarbeitung

**Impact:** Hoch - Ungültige Daten könnten verarbeitet werden

---

### 4. Missing Input Validation für returnUrl ⚠️ **MITTEL**

**Problem:** `returnUrl` wird ohne Validierung verwendet

**Betroffene Datei:** `apps/api/src/routes/billing.ts:131`

**Aktuell:**
```typescript
const { returnUrl } = request.body as { returnUrl?: string };
const finalReturnUrl = returnUrl || `${env.FRONTEND_URL}/membership`;
```

**Problem:**
- Keine URL-Validation
- Mögliche Open Redirect Vulnerability
- Könnte zu Phishing führen

**Empfehlung:**
- URL-Validation (nur erlaubte Domains)
- Whitelist für erlaubte returnUrls
- Oder nur relative URLs erlauben

**Impact:** Mittel - Open Redirect möglich

---

## 🟡 Mittelschwere Sicherheitsprobleme

### 5. Error Messages können Informationen preisgeben ⚠️ **MITTEL**

**Problem:** Einige Error Messages enthalten möglicherweise zu viele Details

**Beispiele:**
- `apps/api/src/routes/internal.ts:55` - "User not found: {clerkUserId}" 
- Prisma Error Codes werden direkt zurückgegeben

**Empfehlung:**
- Generic Error Messages in Production
- Sensible Informationen nur loggen, nicht in Response

**Impact:** Mittel - Information Disclosure

---

### 6. CORS Konfiguration zu permissiv? 🔄 **NIEDRIG**

**Problem:** CORS erlaubt localhost:3000 zusätzlich zur Frontend-URL

**Betroffene Datei:** `apps/api/src/index.ts:44`

**Aktuell:**
```typescript
await fastify.register(cors, {
  origin: [env.FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
});
```

**Problem:**
- localhost:3000 ist hardcoded
- In Production möglicherweise unnötig

**Empfehlung:**
- Nur in Development erlauben
- Environment-basiert konfigurieren

**Impact:** Niedrig - sollte aber dokumentiert sein

---

### 7. Mock Auth in Development ⚠️ **NIEDRIG**

**Problem:** Mock Authentication in Development ohne Clerk

**Betroffene Datei:** `apps/api/src/middleware/auth.ts:224-250`

**Aktuell:**
```typescript
if (!env.CLERK_SECRET_KEY && env.NODE_ENV === 'development') {
  // Mock auth mit demo@mojo-institut.de
}
```

**Empfehlung:**
- Dokumentieren dass Mock Auth nur in Development aktiv ist
- Sicherstellen dass in Production niemals aktiv ist
- Warning-Log hinzufügen

**Impact:** Niedrig - nur Development, aber sollte klar dokumentiert sein

---

### 8. CSP deaktiviert ⚠️ **MITTEL**

**Problem:** Content Security Policy ist deaktiviert

**Betroffene Datei:** `apps/api/src/index.ts:50`

**Aktuell:**
```typescript
await fastify.register(helmet, {
  contentSecurityPolicy: false,
});
```

**Empfehlung:**
- CSP für API-Endpunkte ist meist nicht notwendig (JSON Responses)
- Für Frontend sollte CSP aktiviert sein
- Dokumentieren warum deaktiviert

**Impact:** Mittel - Frontend sollte CSP haben (Next.js macht das)

---

## ✅ Gute Sicherheitspraktiken (bereits implementiert)

### ✅ Authentifizierung & Autorisierung

- **JWT-Verifizierung:** Korrekte Verwendung von Clerk JWT-Verifizierung
- **RBAC:** Rollenbasierte Zugriffskontrolle implementiert
- **Tenant Isolation:** Queries nutzen `auth.userId` und `auth.activeTenant.id`
- **Middleware:** Auth-Middleware auf allen geschützten Routes

### ✅ Input Validation

- **Zod Schemas:** Meiste Inputs werden mit Zod validiert
- **Type Safety:** TypeScript für Typensicherheit

### ✅ SQL Injection Schutz

- **Prisma ORM:** Verwendet Parameterized Queries automatisch
- **Keine Raw Queries:** Keine direkten SQL-Queries gefunden

### ✅ Webhook Security

- **Signature Verification:** Webhooks verwenden HMAC-Signaturen
- **Idempotency:** Clerk Webhooks haben Idempotency-Check
- **Svix Library:** Verwendet offizielle Svix-Bibliothek für Clerk

### ✅ Rate Limiting

- **100 Requests/Minute:** Rate Limiting aktiviert
- **Alle Routes:** Rate Limiting auf alle Routes angewendet

### ✅ Security Headers

- **Helmet:** Security Headers aktiviert (außer CSP)
- **CORS:** Restriktive CORS-Konfiguration

### ✅ Secrets Management

- **Environment Variables:** Secrets aus Environment
- **Validation:** Environment-Variablen werden validiert
- **Keine Hardcoded Secrets:** Keine Secrets im Code gefunden

---

## 📋 Priorisierte Empfehlungen

### 🔴 Kritisch (sofort beheben)

1. **Webhook Signature Verification reparieren**
   - Raw Body vor Parsing erhalten
   - Signature gegen rohen Body verifizieren

2. **Internal API Authentication verbessern**
   - `crypto.timingSafeEqual()` verwenden

### 🟠 Hoch (bald beheben)

3. **Input Validation für Consents**
   - Zod Schema erstellen und verwenden

4. **returnUrl Validation**
   - URL-Whitelist oder relative URLs nur

### 🟡 Mittel (längerfristig)

5. **Error Messages generischer machen**
   - Production: Generic Messages
   - Details nur in Logs

6. **CORS konfigurierbarer machen**
   - Environment-basiert
   - localhost nur in Development

7. **Mock Auth dokumentieren**
   - Klare Dokumentation
   - Warning-Logs

---

## 🛠️ Konkrete Verbesserungsvorschläge

### Fix 1: Webhook Signature Verification

```typescript
// In webhooks.ts - BEFORE registering routes
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  done(null, body as string);
});

// In verifyWebhookSignature
async function verifyWebhookSignature(secret: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['x-webhook-signature'] as string;
    const rawBody = request.body as string; // ✅ Jetzt ist es ein String!
    
    // Parse body AFTER verification
    const payload = JSON.parse(rawBody);
    
    if (!verifySignature(rawBody, signature, secret)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    
    // Set parsed body for handler
    request.body = payload;
  };
}
```

### Fix 2: Timing-Safe Token Comparison

```typescript
import { timingSafeEqual } from 'crypto';

if (!token) {
  return reply.status(401).send({ error: 'Unauthorized' });
}

const secretBuffer = Buffer.from(env.INTERNAL_API_SECRET, 'utf8');
const tokenBuffer = Buffer.from(token, 'utf8');

if (secretBuffer.length !== tokenBuffer.length) {
  return reply.status(401).send({ error: 'Unauthorized' });
}

if (!timingSafeEqual(secretBuffer, tokenBuffer)) {
  return reply.status(401).send({ error: 'Unauthorized' });
}
```

### Fix 3: Consents Validation Schema

```typescript
// In @accounts/shared schemas
export const consentUpdateSchema = z.object({
  consents: z.array(z.object({
    type: z.string().min(1),
    granted: z.boolean(),
  })).min(1),
});

// In profile.ts
const input = consentUpdateSchema.parse(request.body);
```

### Fix 4: returnUrl Validation

```typescript
function validateReturnUrl(url: string | undefined): string {
  if (!url) {
    return `${env.FRONTEND_URL}/membership`;
  }
  
  try {
    const urlObj = new URL(url);
    
    // Only allow same origin
    const allowedOrigin = new URL(env.FRONTEND_URL).origin;
    if (urlObj.origin !== allowedOrigin) {
      return `${env.FRONTEND_URL}/membership`;
    }
    
    return url;
  } catch {
    // Invalid URL, use default
    return `${env.FRONTEND_URL}/membership`;
  }
}
```

---

## 📝 Checkliste für Implementierung

### Phase 1: Kritische Fixes
- [ ] Webhook Signature Verification reparieren
- [ ] Internal API Timing-Safe Comparison

### Phase 2: Hochpriorität
- [ ] Consents Input Validation
- [ ] returnUrl Validation

### Phase 3: Verbesserungen
- [ ] Error Messages generischer
- [ ] CORS konfigurierbarer
- [ ] Mock Auth dokumentieren

---

**Erstellt:** 2024-12-29  
**Version:** 1.0

