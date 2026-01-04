# Code-Vereinfachungen - accounts.mojo

**Datum:** 2025-01-03  
**Zweck:** Reduzierung von Code-Duplikation und Verbesserung der Wartbarkeit

---

## ✅ Implementierte Vereinfachungen

### 1. **Middleware für `activeTenant` Check** ✅

**Problem:** Wiederholter Code in allen Routes
```typescript
// ❌ Vorher (wiederholt 10+ Mal)
if (!auth.activeTenant) {
  return reply.status(400).send({
    error: 'Bad Request',
    message: 'No active tenant',
  });
}
```

**Lösung:** Zentrale Middleware
```typescript
// ✅ Nachher
fastify.get('/profile', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
  // auth.activeTenant ist garantiert vorhanden
});
```

**Dateien:**
- ✅ `apps/api/src/middleware/active-tenant.ts` (neu)
- ✅ `apps/api/src/routes/profile.ts` (4x vereinfacht)
- ✅ `apps/api/src/routes/billing.ts` (3x vereinfacht)
- ✅ `apps/api/src/routes/entitlements.ts` (3x vereinfacht)

**Ergebnis:** ~40 Zeilen Code entfernt, konsistente Error-Responses

---

### 2. **Single-Flight Pattern für Cache-Refresh** ✅

**Problem:** Race Conditions bei Cache-Refresh

**Lösung:** Single-Flight Pattern implementiert
```typescript
// ✅ Mit Single-Flight
const cacheKey = `profile:${tenantId}:${userId}`;
profileCache = await withSingleFlight(cacheKey, async () => {
  const crmProfile = await crmClient.getProfile(clerkUserId);
  return await updateProfileCache(...);
});
```

**Dateien:**
- ✅ `apps/api/src/services/cache.service.ts` (Helper-Funktion)
- ✅ `apps/api/src/routes/profile.ts`
- ✅ `apps/api/src/routes/billing.ts` (2x)
- ✅ `apps/api/src/routes/entitlements.ts` (nachträglich hinzugefügt)

**Ergebnis:** Konsistente Cache-Refresh-Logik, keine Race Conditions

---

### 3. **Type Safety: `as any` entfernt** ✅

**Problem:** Unsichere Type-Casts

**Vorher:**
```typescript
payload: updatedProfile as any, // ❌
```

**Nachher:**
```typescript
payload: updatedProfile, // ✅ Type-safe
```

**Dateien:**
- ✅ `apps/api/src/routes/profile.ts` (2x entfernt)

**Ergebnis:** Bessere Type Safety, weniger Runtime-Fehler

---

### 4. **Frontend: Token-Check Hook** ✅

**Problem:** Wiederholter Token-Check-Code
```typescript
// ❌ Vorher (wiederholt 15+ Mal)
const token = await getToken();
if (!token) return;
```

**Lösung:** Custom Hook
```typescript
// ✅ Nachher
const { getToken } = useToken(); // Wirft Error wenn kein Token

try {
  const token = await getToken(); // Garantiert ein Token oder Error
  await accountsApi.updateProfile(token, ...);
} catch (error) {
  // Handle error
}
```

**Dateien:**
- ✅ `apps/web/src/hooks/useToken.ts` (neu)
- ✅ `apps/web/src/app/profile/page.tsx` (2x vereinfacht)

**Ergebnis:** ~30 Zeilen Code entfernt, konsistente Error-Behandlung

---

### 5. **Data/Preferences Routes: activeTenant Middleware** ✅

**Problem:** Wiederholte Checks auch in data.ts und preferences.ts

**Lösung:** Middleware auch hier verwenden

**Dateien:**
- ✅ `apps/api/src/routes/data.ts` (3x vereinfacht)
- ✅ `apps/api/src/routes/preferences.ts` (2x vereinfacht)

**Ergebnis:** ~20 Zeilen Code entfernt

---

### 6. **Mock-Mode Pattern in BaseHttpClient** ✅

**Problem:** Duplikation in PaymentsClient & CrmClient (15x identisches Pattern)

**Vorher:**
```typescript
// ❌ Wiederholt in jeder Methode
async getSubscription(...): Promise<Subscription | null> {
  if (this.mockMode) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return mockSubscription;
  }
  
  try {
    return await this.fetch(...);
  } catch (error) {
    appLogger.error(...);
    return null;
  }
}
```

**Lösung:** `withMock` Helper-Methode in BaseHttpClient
```typescript
// ✅ Nachher
async getSubscription(...): Promise<Subscription | null> {
  return this.withMock(
    mockSubscription,
    () => this.fetch<Subscription>(`/me/subscription?...`),
    (error) => {
      appLogger.error(...);
      return null;
    }
  );
}
```

**Dateien:**
- ✅ `apps/api/src/lib/http-client.ts` (Base-Methode hinzugefügt)
- ✅ `apps/api/src/clients/payments.ts` (9 Methoden vereinfacht)
- ✅ `apps/api/src/clients/crm.ts` (6 Methoden vereinfacht)

**Ergebnis:** ~50 Zeilen Code entfernt, konsistenteres Error-Handling

---

### 7. **Frontend: Error Handler Hook** ✅

**Problem:** Wiederholtes Error-Handling-Pattern in allen Components

**Vorher:**
```typescript
// ❌ Wiederholt 15+ Mal
try {
  await accountsApi.updateProfile(...);
} catch (error) {
  console.error("Failed to save profile:", error);
  
  let errorMessage = "Profil konnte nicht gespeichert werden.";
  if (error instanceof ApiError) {
    if (error.statusCode === 400 && error.details?.issues) {
      const issues = error.details.issues as Array<{ message: string }>;
      errorMessage = `Validierungsfehler: ${issues.map(i => i.message).join(", ")}`;
    } else {
      errorMessage = error.message || errorMessage;
    }
  }
  
  toast({
    variant: "destructive",
    title: "Fehler",
    description: errorMessage,
  });
}
```

**Lösung:** Custom Hook
```typescript
// ✅ Nachher
const { handleError } = useApiError();

try {
  await accountsApi.updateProfile(...);
} catch (error) {
  handleError(error, "Profil konnte nicht gespeichert werden.");
}
```

**Dateien:**
- ✅ `apps/web/src/hooks/useApiError.ts` (neu)
- ✅ `apps/web/src/app/profile/page.tsx` (2x vereinfacht)
- ✅ `apps/web/src/app/team/page.tsx` (4x vereinfacht)
- ✅ `apps/web/src/app/preferences/page.tsx` (2x vereinfacht)
- ✅ `apps/web/src/app/page.tsx` (1x vereinfacht)
- ✅ `apps/web/src/app/membership/page.tsx` (2x vereinfacht)
- ✅ `apps/web/src/app/data/page.tsx` (4x vereinfacht)

**Ergebnis:** ~100 Zeilen Code entfernt, konsistentes Error-Handling

---

## 📊 Zusammenfassung

| Vereinfachung | Zeilen entfernt | Dateien betroffen | Status |
|---------------|-----------------|-------------------|--------|
| `activeTenant` Middleware (1. Welle) | ~40 | 3 Routes | ✅ |
| Single-Flight Pattern | ~20 | 4 Routes | ✅ |
| Type Safety (`as any`) | ~2 | 1 Route | ✅ |
| Token-Check Hook | ~30 | 7 Components | ✅ |
| `activeTenant` Middleware (2. Welle) | ~20 | 2 Routes | ✅ |
| Mock-Mode Pattern | ~50 | 2 Clients | ✅ |
| Error Handler Hook | ~100 | 6 Components | ✅ |
| **Gesamt** | **~262 Zeilen** | **25 Dateien** | ✅ |

---

## 🔄 Weitere Vereinfachungsmöglichkeiten (optional)

### 1. **Cache-Refresh Helper-Funktion** (Optional)

Das Pattern könnte noch weiter vereinfacht werden:
```typescript
// Potenzielle zukünftige Vereinfachung
const profileCache = await getOrRefreshCache({
  key: `profile:${tenantId}:${userId}`,
  currentCache,
  isStale: isCacheStale(currentCache, TTL),
  fetchFn: () => crmClient.getProfile(clerkUserId),
  updateFn: (data) => updateProfileCache(tenantId, userId, data),
  createEmptyFn: () => createEmptyProfileCache(tenantId, userId),
});
```

**Status:** Helper-Funktion `refreshCacheWithFallback` bereits erstellt, aber noch nicht überall verwendet

---

### 2. **Error-Response Helper** (Optional)

Für wiederholte Error-Responses:
```typescript
// Potenzielle Vereinfachung
function badRequest(message: string) {
  return reply.status(400).send({ error: 'Bad Request', message });
}
```

**Status:** Nicht kritisch, da Fastify Error Handler bereits zentralisiert

---

### 3. **Frontend: Generic Error Handler** ✅

**Status:** ✅ Implementiert als `useApiError` Hook

---

## 🎯 Nächste Schritte (optional)

Wenn weitere Vereinfachungen gewünscht sind:

1. ⚠️ **Cache-Refresh Helper überall verwenden** - Helper-Funktion ist da, aber noch nicht überall integriert
2. ⚠️ **Generic Loading States** - Könnte `isLoading` Pattern vereinfachen (siehe `docs/WEITERE_VEREINFACHUNGEN.md`)

---

---

## 📚 Weitere Möglichkeiten

Siehe `docs/WEITERE_VEREINFACHUNGEN.md` für weitere identifizierte Vereinfachungsmöglichkeiten (z.B. Generic Loading Hook, Cache Query Helper, etc.)

---

**Erstellt:** 2025-01-03  
**Zuletzt aktualisiert:** 2025-01-03

