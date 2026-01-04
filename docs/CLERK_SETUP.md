# Clerk Setup & Konfiguration

> **Korrekte Clerk-Konfiguration für account.mojo mit Basic Auth Loop-Prävention**

**Erstellt:** 2025-01-03  
**Status:** ✅ Implementiert

---

## Übersicht

Diese Dokumentation beschreibt die korrekte Clerk-Konfiguration für `account.mojo`, die **Basic Auth Loops vermeidet** und den Konventionen aus `platform.mojo` folgt.

---

## Implementierte Lösung

### 1. Docker Compose Staging: Clerk-Routen explizit ausgenommen

**Problem:** Basic Auth auf Clerk-Auth-Routen (`/sign-in`, `/sign-up`, `/api/webhooks/clerk`) führt zu Auth-Loops.

**Lösung:** Priority-System mit separaten Routen für Clerk-Auth ohne Basic Auth.

#### Frontend-Routen

```yaml
# Clerk Auth Routes (OHNE Basic Auth) - Priority 20 (höchste Priorität)
- "traefik.http.routers.accounts-clerk-staging.rule=Host(`account.staging.mojo-institut.de`) && (PathPrefix(`/sign-in`) || PathPrefix(`/sign-up`) || PathPrefix(`/api/webhook`) || PathPrefix(`/api/clerk`))"
- "traefik.http.routers.accounts-clerk-staging.middlewares=staging-headers@file"
- "traefik.http.routers.accounts-clerk-staging.priority=20"

# Main Frontend Routes (MIT Basic Auth) - Priority 1 (niedrigste Priorität)
- "traefik.http.routers.accounts-web-staging.rule=Host(`account.staging.mojo-institut.de`) && !PathPrefix(`/api`) && !PathPrefix(`/sign-in`) && !PathPrefix(`/sign-up`) && !PathPrefix(`/api/webhook`) && !PathPrefix(`/api/clerk`)"
- "traefik.http.routers.accounts-web-staging.middlewares=staging-basicauth@file,staging-headers@file"
- "traefik.http.routers.accounts-web-staging.priority=1"
```

#### API-Routen

```yaml
# Clerk Webhook Routes (OHNE Basic Auth) - Priority 20
- "traefik.http.routers.accounts-clerk-webhook-staging.rule=Host(`account.staging.mojo-institut.de`) && PathPrefix(`/api/v1/webhooks/clerk`) || PathPrefix(`/api/webhooks/clerk`)"
- "traefik.http.routers.accounts-clerk-webhook-staging.middlewares=staging-headers@file"
- "traefik.http.routers.accounts-clerk-webhook-staging.priority=20"

# Health Check Routes (OHNE Basic Auth) - Priority 15
- "traefik.http.routers.accounts-health-staging.rule=Host(`account.staging.mojo-institut.de`) && (Path(`/health`) || Path(`/api/health`) || PathPrefix(`/api/v1/health`))"
- "traefik.http.routers.accounts-health-staging.middlewares=staging-headers@file"
- "traefik.http.routers.accounts-health-staging.priority=15"

# Main API Routes (MIT Basic Auth) - Priority 1
- "traefik.http.routers.accounts-api-staging.rule=Host(`account.staging.mojo-institut.de`) && PathPrefix(`/api`) && !PathPrefix(`/api/v1/webhooks/clerk`) && !PathPrefix(`/api/webhooks/clerk`) && !Path(`/health`) && !Path(`/api/health`) && !PathPrefix(`/api/v1/health`)"
- "traefik.http.routers.accounts-api-staging.middlewares=staging-basicauth@file,staging-headers@file"
- "traefik.http.routers.accounts-api-staging.priority=1"
```

**Priority-Erklärung:**
- **Priority 20:** Höchste Priorität für Clerk-Routen (werden zuerst matchen)
- **Priority 15:** Health Checks (werden vor Main-Routen matchen)
- **Priority 1:** Niedrigste Priorität für Main-Routen (werden zuletzt matchen)

---

### 2. ClerkProvider Konfiguration

**File:** `apps/web/src/app/layout.tsx`

```tsx
<ClerkProvider
  afterSignInUrl="/"
  afterSignUpUrl="/"
  signInFallbackRedirectUrl="/"
  signUpFallbackRedirectUrl="/"
  appearance={{...}}
>
```

**Konfigurierte Redirect-URLs:**
- `afterSignInUrl`: Dashboard (`/`)
- `afterSignUpUrl`: Dashboard (`/`)
- `signInFallbackRedirectUrl`: Fallback zu Dashboard
- `signUpFallbackRedirectUrl`: Fallback zu Dashboard

---

### 3. Middleware: Redirect-Loop Prävention

**File:** `apps/web/src/middleware.ts`

**Implementiert:**
- ✅ Eingeloggte User werden von `/sign-in` und `/sign-up` automatisch redirectet
- ✅ Redirect-URLs aus Query-Parametern werden berücksichtigt
- ✅ Protected API Routes benötigen Authentifizierung
- ✅ Public Routes (Webhooks, Health Checks) sind frei zugänglich

**Wichtig:** Die Middleware ist **die einzige Quelle für Auth-Redirects**. Layout-Komponenten machen keine Redirects.

---

### 4. Sign-In & Sign-Up Seiten

**Files:**
- `apps/web/src/app/(auth)/sign-in/page.tsx`
- `apps/web/src/app/(auth)/sign-up/page.tsx`

**Features:**
- ✅ Standard Clerk `<SignIn />` und `<SignUp />` Komponenten
- ✅ Client-Side Fallback Redirect (wenn Middleware nicht greift)
- ✅ Query-Parameter Support für `redirect_url`
- ✅ Zentriertes Layout mit minimalem Styling

---

## Router-Prioritäten (Traefik)

```
Priority 20: Clerk Auth Routes (kein Basic Auth)
├── /sign-in
├── /sign-up
├── /api/webhook
└── /api/clerk

Priority 15: Health Checks (kein Basic Auth)
├── /health
├── /api/health
└── /api/v1/health

Priority 10: API Routes (mit Basic Auth)
└── /api/* (außer oben genannte)

Priority 1: Frontend Routes (mit Basic Auth)
└── /* (außer oben genannte)
```

---

## Troubleshooting

### Problem: Basic Auth Loop

**Symptom:**
- Browser fragt immer wieder nach Basic Auth Credentials
- Nach Clerk Login erscheint erneut Basic Auth Prompt

**Lösung:**
1. Browser-Cache leeren (`Strg + Shift + Del` / `Cmd + Shift + Del`)
2. Oder: Inkognito/Private-Modus verwenden
3. Prüfen, ob Clerk-Routen korrekt ausgenommen sind (Priority 20)

### Problem: Webhooks funktionieren nicht

**Symptom:**
- Clerk Webhooks werden nicht verarbeitet
- 401 Unauthorized von Traefik

**Lösung:**
1. Prüfen, ob Webhook-Route Priority 20 hat
2. Prüfen, ob `staging-headers@file` (nicht `staging-basicauth@file`) verwendet wird
3. Prüfen, ob Webhook-Pfad korrekt ist: `/api/v1/webhooks/clerk`

### Problem: Health Checks schlagen fehl

**Symptom:**
- Health Check gibt 401 zurück (Basic Auth)
- CI/CD Pipeline schlägt fehl

**Lösung:**
1. Health Check Route sollte Priority 15 haben (ohne Basic Auth)
2. CI/CD Health Check sollte HTTP 401 für Staging akzeptieren (siehe `ci-staging.yml`)

---

## Testing Checklist

- [ ] Sign-In funktioniert auf Staging (ohne Basic Auth Loop)
- [ ] Sign-Up funktioniert auf Staging (ohne Basic Auth Loop)
- [ ] Clerk Webhooks werden verarbeitet (ohne Basic Auth)
- [ ] Health Checks funktionieren (ohne Basic Auth)
- [ ] Dashboard ist mit Basic Auth geschützt
- [ ] API Routes sind mit Basic Auth geschützt
- [ ] Redirect nach Sign-In/Sign-Up funktioniert korrekt
- [ ] Query-Parameter `redirect_url` wird respektiert

---

## Referenzen

- [platform.mojo CODING_STANDARDS.md - Section 3: Clerk Authentication](../../../platform.mojo/docs/CODING_STANDARDS.md#3-clerk-authentication)
- [platform.mojo STAGING_SERVER_CONVENTION.md - Section 11: Security Policy](../../../platform.mojo/docs/STAGING_SERVER_CONVENTION.md#11-security-policy)
- [Clerk Next.js Documentation](https://clerk.com/docs/references/nextjs/overview)

---

**Zuletzt aktualisiert:** 2025-01-03

