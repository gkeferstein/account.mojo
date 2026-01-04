# Weitere Vereinfachungsmöglichkeiten - accounts.mojo

**Datum:** 2025-01-03  
**Status:** Analyse & Empfehlungen

---

## 🔍 Identifizierte Vereinfachungsmöglichkeiten

### 1. **Mock-Mode Pattern Duplikation** 🔄 **HOCH**

**Problem:** Identisches Mock-Mode-Pattern in beiden Clients

**Betroffene Dateien:**
- `apps/api/src/clients/payments.ts` - 9x `if (this.mockMode) { await delay; return mockData }`
- `apps/api/src/clients/crm.ts` - 6x `if (this.mockMode) { await delay; return mockData }`

**Vorher:**
```typescript
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

**Nachher (Empfehlung):**
```typescript
// In BaseHttpClient
protected async withMock<T>(
  mockData: T,
  realFetch: () => Promise<T>,
  onError?: (error: unknown) => T | null
): Promise<T | null> {
  if (this.mockMode) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return mockData;
  }
  
  try {
    return await realFetch();
  } catch (error) {
    if (onError) return onError(error);
    return null;
  }
}

// Verwendung:
async getSubscription(...): Promise<Subscription | null> {
  return this.withMock(
    mockSubscription,
    () => this.fetch<Subscription>(`/me/subscription?...`),
    (error) => {
      appLogger.error('Failed to fetch subscription', { error, ... });
      return null;
    }
  );
}
```

**Impact:** ~50 Zeilen Code entfernt, konsistenteres Error-Handling

---

### 2. **Frontend: Generic Error Handler Hook** 🔄 **MITTEL**

**Problem:** Wiederholtes Error-Handling-Pattern in allen Components

**Betroffene Dateien:**
- `apps/web/src/app/profile/page.tsx`
- `apps/web/src/app/team/page.tsx`
- `apps/web/src/app/preferences/page.tsx`
- `apps/web/src/app/membership/page.tsx`
- `apps/web/src/app/data/page.tsx`

**Vorher:**
```typescript
try {
  await accountsApi.updateProfile(...);
  toast({ title: "Gespeichert", description: "..." });
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

**Nachher (Empfehlung):**
```typescript
// hooks/useApiError.ts
export function useApiError() {
  const { toast } = useToast();
  
  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    console.error(error);
    
    let errorMessage = defaultMessage;
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
  }, [toast]);
  
  return { handleError };
}

// Verwendung:
const { handleError } = useApiError();

try {
  await accountsApi.updateProfile(...);
  toast({ title: "Gespeichert", description: "..." });
} catch (error) {
  handleError(error, "Profil konnte nicht gespeichert werden.");
}
```

**Impact:** ~100 Zeilen Code entfernt, konsistentere Error-Handling

---

### 3. **Frontend: Generic Loading State Hook** 🔄 **NIEDRIG**

**Problem:** Wiederholtes `useState` + `setIsLoading` Pattern

**Vorher:**
```typescript
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);

useEffect(() => {
  async function fetchData() {
    setIsLoading(true);
    try {
      // ...
    } finally {
      setIsLoading(false);
    }
  }
  fetchData();
}, []);
```

**Nachher (Empfehlung):**
```typescript
// hooks/useAsync.ts
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList = []
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    
    asyncFn()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setIsLoading(false);
        }
      });
    
    return () => { cancelled = true; };
  }, deps);
  
  return { data, isLoading, error };
}

// Verwendung:
const { data: profile, isLoading, error } = useAsync(
  async () => {
    const token = await getToken();
    return accountsApi.getProfile(token);
  },
  [getToken]
);
```

**Impact:** ~60 Zeilen Code entfernt, weniger Boilerplate

---

### 4. **Data Routes: activeTenant Check** 🔄 **NIEDRIG**

**Problem:** Wiederholte `activeTenant` Checks (bereits Middleware vorhanden!)

**Betroffene Datei:**
- `apps/api/src/routes/data.ts` - 3x wiederholt

**Vorher:**
```typescript
fastify.get('/data/requests', async (request, reply) => {
  if (!auth.activeTenant) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'No active tenant',
    });
  }
  // ...
});
```

**Nachher:**
```typescript
fastify.get('/data/requests', { preHandler: [requireActiveTenant()] }, async (request, reply) => {
  // auth.activeTenant ist garantiert vorhanden
  // ...
});
```

**Impact:** ~12 Zeilen Code entfernt

---

### 5. **Preferences Routes: activeTenant Check** 🔄 **NIEDRIG**

**Problem:** Gleiches wie #4

**Betroffene Datei:**
- `apps/api/src/routes/preferences.ts` - 2x wiederholt

**Impact:** ~8 Zeilen Code entfernt

---

### 6. **Client Error-Handling Strategie vereinheitlichen** 🔄 **MITTEL**

**Problem:** Unterschiedliche Error-Strategien in Clients

**PaymentsClient:**
- `getSubscription` → `return null` bei Fehler
- `getGdprExport` → `throw error` bei Fehler
- `anonymizeCustomer` → `throw error` bei Fehler

**CrmClient:**
- Alle Methoden → `return null` bei Fehler

**Empfehlung:** Klare Strategie
- **Read-Operations** → `return null` oder leeren Array (Graceful Degradation)
- **Write-Operations** → `throw error` (muss erfolgreich sein)
- **Critical Operations** → `throw error` (GDPR, Deletion)

**Impact:** Konsistentere API, weniger Verwirrung

---

### 7. **Frontend: useToken Hook überall verwenden** 🔄 **NIEDRIG**

**Problem:** Noch nicht alle Components verwenden `useToken` Hook

**Betroffene Dateien:**
- `apps/web/src/app/team/page.tsx` - verwendet noch `useAuth`
- `apps/web/src/app/preferences/page.tsx` - verwendet noch `useAuth`
- `apps/web/src/app/page.tsx` - verwendet noch `useAuth`
- `apps/web/src/app/membership/page.tsx` - verwendet noch `useAuth`
- `apps/web/src/app/data/page.tsx` - verwendet noch `useAuth`

**Impact:** Konsistenz, ~25 Zeilen Code entfernt

---

### 8. **Prisma Query Pattern: Cache findUnique** 🔄 **NIEDRIG**

**Problem:** Wiederholtes Pattern für Cache-Queries

**Vorher:**
```typescript
let cache = await prisma.profileCache.findUnique({
  where: {
    tenantId_userId: {
      tenantId: auth.activeTenant.id,
      userId: auth.userId,
    },
  },
});
```

**Nachher (Empfehlung):**
```typescript
// lib/cache-helpers.ts
export function getCacheQuery(tenantId: string, userId: string) {
  return {
    tenantId_userId: {
      tenantId,
      userId,
    },
  };
}

// Verwendung:
let cache = await prisma.profileCache.findUnique({
  where: getCacheQuery(auth.activeTenant.id, auth.userId),
});
```

**Impact:** ~5 Zeilen pro Query gespart, konsistentere Queries

---

### 9. **Data Request Duplikation** 🔄 **NIEDRIG**

**Problem:** Export und Delete Request haben sehr ähnliche Logik

**Betroffene Datei:**
- `apps/api/src/routes/data.ts` - `export-request` und `delete-request` sehr ähnlich

**Vorher:** 70+ Zeilen duplizierter Code

**Empfehlung:** Helper-Funktion
```typescript
async function createDataRequest(
  request: FastifyRequest,
  type: 'export' | 'delete',
  reason?: string
) {
  // Gemeinsame Logik extrahieren
}
```

**Impact:** ~40 Zeilen Code entfernt

---

## 📊 Priorisierung

| # | Vereinfachung | Impact | Aufwand | Priorität |
|---|---------------|--------|---------|-----------|
| 1 | Mock-Mode Pattern | Hoch (~50 Zeilen) | Mittel | 🟠 |
| 2 | Frontend Error Handler Hook | Hoch (~100 Zeilen) | Mittel | 🟠 |
| 3 | Frontend Loading Hook | Mittel (~60 Zeilen) | Hoch | 🟡 |
| 4 | Data Routes activeTenant | Niedrig (~12 Zeilen) | Niedrig | 🟢 |
| 5 | Preferences Routes activeTenant | Niedrig (~8 Zeilen) | Niedrig | 🟢 |
| 6 | Client Error-Strategie | Mittel | Niedrig | 🟠 |
| 7 | useToken Hook überall | Niedrig (~25 Zeilen) | Niedrig | 🟢 |
| 8 | Cache Query Helper | Niedrig (~20 Zeilen) | Niedrig | 🟢 |
| 9 | Data Request Helper | Mittel (~40 Zeilen) | Mittel | 🟡 |

**Gesamtpotenzial:** ~315 Zeilen Code entfernt

---

## 🎯 Empfehlung: Nächste Schritte

### Sofort umsetzen (Niedriger Aufwand, sofortiger Nutzen):
1. ✅ **Data/Preferences Routes:** `requireActiveTenant()` verwenden
2. ✅ **useToken Hook:** Überall verwenden
3. ✅ **Cache Query Helper:** Erstellen und verwenden

### Mittelfristig (Mittel-Hoher Impact):
4. ✅ **Mock-Mode Pattern:** Base-Methode in `BaseHttpClient`
5. ✅ **Frontend Error Handler:** Hook erstellen
6. ✅ **Client Error-Strategie:** Dokumentieren und vereinheitlichen

### Optional (Aufwand-Nutzen abwägen):
7. ⚠️ **Frontend Loading Hook:** Komplexer, aber könnte nützlich sein
8. ⚠️ **Data Request Helper:** Nur wenn weitere Request-Typen kommen

---

**Erstellt:** 2025-01-03  
**Zuletzt aktualisiert:** 2025-01-03

