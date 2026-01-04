# Konventionen-Analyse: account.mojo

> **Vergleich mit platform.mojo Standards und payments.mojo Best Practices**

**Erstellt:** 2025-01-03  
**Version:** 1.0.0

---

## Executive Summary

### Gesamtbewertung: ⚠️ **75/100** - Gute Basis, Verbesserungspotenzial

**Stärken:**
- ✅ Design System Integration (`@gkeferstein/design`)
- ✅ Health Check Endpoints vorhanden
- ✅ Docker + Traefik Deployment
- ✅ CI/CD Pipelines implementiert
- ✅ Multitenancy mit `@gkeferstein/tenant`

**Kritische Punkte:**
- ⚠️ **Staging Domain:** Verwendet `account.staging.*` statt `accounts.staging.*` (Konvention: Plural)
- ⚠️ **Basic Auth:** Fehlt in Staging Docker Compose (Konvention erfordert Basic Auth für Staging)
- ⚠️ **API-Pfad:** Verwendet `/api/v1/` statt `/api/` (Konvention: keine Versionierung)
- ⚠️ **Clerk Routes:** Keine explizite Trennung von Clerk-Auth-Routen (Basic Auth Loop-Risiko)
- ⚠️ **Secrets:** Verwendet `PROD_SERVER_SSH_KEY` statt `PRODUCTION_SSH_KEY` (Konvention)

---

## 1. Domain-Konventionen

### Status: ⚠️ **Teilweise konform**

#### Aktuell (account.mojo)

| Umgebung | Domain | Status |
|----------|--------|--------|
| Staging | `account.staging.mojo-institut.de` | ⚠️ **Falsch** |
| Production | `account.mojo-institut.de` | ⚠️ **Unklar** |

#### Konvention (platform.mojo)

| Umgebung | Pattern | Beispiel |
|----------|---------|----------|
| Staging | `{app}.staging.mojo-institut.de` | `accounts.staging.mojo-institut.de` |
| Production | `{app}.mojo-institut.de` | `accounts.mojo-institut.de` |

**Probleme:**
1. **Staging Domain:** Verwendet `account.staging.*` statt `accounts.staging.*`
   - README.md zeigt: `account.staging.mojo-institut.de`
   - `.cursorrules` zeigt: `account.staging.mojo-institut.de`
   - **Konvention:** App-Namen sollten im Plural sein (siehe `payments.mojo`, `accounts.mojo`)

2. **Inkonsistenz zwischen Docs:**
   - README.md: `accounts.mojo-institut.de` (Production)
   - `.cursorrules`: `account.mojo-institut.de` (Production)

**Empfehlung:**
```yaml
# docker-compose.staging.yml
- "traefik.http.routers.accounts-api-staging.rule=Host(`accounts.staging.mojo-institut.de`) && PathPrefix(`/api`)"
- "traefik.http.routers.accounts-web-staging.rule=Host(`accounts.staging.mojo-institut.de`) && !PathPrefix(`/api`)"

# docker-compose.production.yml
- "traefik.http.routers.accounts-api-prod.rule=Host(`accounts.mojo-institut.de`) && PathPrefix(`/api`)"
- "traefik.http.routers.accounts-web-prod.rule=Host(`accounts.mojo-institut.de`) && !PathPrefix(`/api`)"
```

**Bewertung:** 3/5 ⚠️

---

## 2. Docker Compose & Traefik Labels

### Status: ⚠️ **Kritische Abweichungen**

#### Vergleich mit payments.mojo

| Kriterium | payments.mojo | account.mojo | Status |
|-----------|---------------|--------------|--------|
| **Staging Basic Auth** | ✅ Aktiviert | ❌ **Fehlt** | ❌ **KRITISCH** |
| **Clerk Routes ausgeschlossen** | ✅ Ja (Priority 20) | ❌ **Fehlt** | ❌ **KRITISCH** |
| **Priority-System** | ✅ Implementiert | ⚠️ Teilweise | ⚠️ |
| **Staging Headers** | ✅ `staging-headers@file` | ❌ **Fehlt** | ❌ |

#### Kritische Probleme

**1. Basic Auth fehlt in Staging**

```yaml
# ❌ AKTUELL (account.mojo/infra/docker-compose.staging.yml)
- "traefik.http.routers.accounts-api-staging.middlewares="  # Leer!
```

```yaml
# ✅ SOLLTE SEIN (gemäß Konvention)
- "traefik.http.routers.accounts-api-staging.middlewares=staging-basicauth@file,staging-headers@file"
```

**2. Clerk-Routen nicht explizit ausgeschlossen**

**Problem:** Basic Auth auf Clerk-Auth-Routen (`/sign-in`, `/sign-up`, `/api/webhook`, `/api/clerk`) führt zu Auth-Loops!

```yaml
# ✅ SOLLTE SEIN (gemäß Konvention)
# Clerk Auth Routes (OHNE Basic Auth) - Priority 20
- "traefik.http.routers.accounts-clerk-staging.rule=Host(`accounts.staging.mojo-institut.de`) && (PathPrefix(`/sign-in`) || PathPrefix(`/sign-up`) || PathPrefix(`/api/webhook`) || PathPrefix(`/api/clerk`))"
- "traefik.http.routers.accounts-clerk-staging.middlewares=staging-headers@file"  # Kein Basic Auth!
- "traefik.http.routers.accounts-clerk-staging.priority=20"

# Main Routes (MIT Basic Auth) - Priority 1
- "traefik.http.routers.accounts-api-staging.rule=Host(`accounts.staging.mojo-institut.de`) && PathPrefix(`/api`) && !PathPrefix(`/sign-in`) && !PathPrefix(`/sign-up`) && !PathPrefix(`/api/webhook`) && !PathPrefix(`/api/clerk`)"
- "traefik.http.routers.accounts-api-staging.middlewares=staging-basicauth@file,staging-headers@file"
- "traefik.http.routers.accounts-api-staging.priority=1"
```

**3. Staging Headers fehlen**

```yaml
# ❌ AKTUELL
- "traefik.http.routers.accounts-api-staging.middlewares="

# ✅ SOLLTE SEIN
- "traefik.http.routers.accounts-api-staging.middlewares=staging-basicauth@file,staging-headers@file"
```

**Staging Headers sollten enthalten:**
- `X-Robots-Tag: noindex` (wichtig für SEO)
- `X-Environment: staging`
- Security Headers

**Bewertung:** 2/5 ❌ **Kritisch**

---

## 3. API-Endpoint Konventionen

### Status: ⚠️ **Nicht konform**

#### Aktuell (account.mojo)

```
/api/v1/health
/api/v1/me
/api/v1/tenants
```

#### Konvention (platform.mojo CODING_STANDARDS.md)

> **Alle APIs nutzen `/api` ohne Versionierung. Breaking Changes werden über Feature-Flags oder neue Endpoints gelöst.**

**Erwartet:**
```
/api/health
/api/me
/api/tenants
```

**Ausnahme:** Health Checks können `/api/health` oder direkt `/health` verwenden (siehe payments.mojo).

**Probleme:**
1. **API-Versionierung:** `/api/v1/` wird verwendet
2. **Health Check:** `/api/v1/health` statt `/api/health` oder `/health`
3. **CI/CD Health Check:** Verwendet `/api/v1/health` (sollte angepasst werden)

**Empfehlung:**
```typescript
// ✅ RICHTIG
fastify.get('/health', ...)           // Direkt /health
fastify.get('/api/health', ...)       // Oder /api/health
fastify.get('/api/me', ...)           // Keine Versionierung
fastify.get('/api/tenants', ...)
```

**Bewertung:** 2/5 ⚠️

---

## 4. CI/CD Pipeline

### Status: ✅ **Sehr gut** (mit kleinen Abweichungen)

#### Stärken

1. ✅ **GitHub Secrets Konvention:** Verwendet `STAGING_SERVER`, `STAGING_SSH_KEY`
2. ✅ **Build Once, Deploy Many:** Release Pipeline validiert Images aus Staging
3. ✅ **Image-Naming:** Korrekt mit `-api` und `-web` Suffix
4. ✅ **Health Checks:** Implementiert (allerdings mit falschem Endpoint)
5. ✅ **Blue/Green Deployment:** Script-basiert

#### Abweichungen

**1. Secrets-Namen inkonsistent**

```yaml
# ❌ AKTUELL (ci-release.yml)
secrets.PROD_SERVER_SSH_KEY
secrets.PROD_SERVER_HOST

# ✅ SOLLTE SEIN (gemäß Konvention)
secrets.PRODUCTION_SSH_KEY
secrets.PRODUCTION_SERVER
```

**2. Health Check Endpoint**

```bash
# ❌ AKTUELL
HEALTH_URL="https://account.staging.mojo-institut.de/api/v1/health"

# ✅ SOLLTE SEIN
HEALTH_URL="https://accounts.staging.mojo-institut.de/api/health"
# ODER
HEALTH_URL="https://accounts.staging.mojo-institut.de/health"
```

**3. Basic Auth Handling**

```bash
# ❌ AKTUELL - Erwartet nur HTTP 200
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Health-Check erfolgreich"
fi

# ✅ SOLLTE SEIN - HTTP 401 für Staging akzeptieren
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Health-Check erfolgreich"
elif [ "$HTTP_CODE" = "401" ] && [ "$ENVIRONMENT" = "staging" ]; then
  echo "✅ Health-Check erfolgreich (Basic Auth aktiv)"
fi
```

**4. Deployment Script**

```bash
# ❌ AKTUELL - Verwendet externes Script
/root/scripts/deploy-blue-green.sh

# ✅ KONVENTION - Script direkt in CI/CD Pipeline eingebettet
# (siehe STAGING_SERVER_CONVENTION.md Abschnitt 9)
```

**Bewertung:** 4/5 ✅ **Sehr gut**

---

## 5. Design System Integration

### Status: ✅ **Vorbildlich**

#### Verwendung von @gkeferstein/design

```typescript
// ✅ Korrekt verwendet
import { MojoShell, MojoBackground } from '@gkeferstein/design';
import { MojoTopbar, MojoTopbarSkeleton } from '@gkeferstein/design';
import { UnifiedSidebar } from '@gkeferstein/design';
```

#### Vergleich mit payments.mojo

| Komponente | payments.mojo | account.mojo | Status |
|-----------|---------------|--------------|--------|
| `MojoShell` | ✅ | ✅ | ✅ |
| `MojoSidebar` | ✅ | ✅ (UnifiedSidebar) | ✅ |
| `MojoTopbar` | ✅ | ✅ | ✅ |
| `MojoAppLayout` | ⚠️ | ❌ | ⚠️ |
| `MojoGlobalHeader` | ⚠️ | ❌ | ⚠️ |

**Empfehlung:**
Gemäß CODING_STANDARDS.md sollte `MojoAppLayout` verwendet werden (kombiniert alle notwendigen Layout-Komponenten).

```tsx
// ✅ EMPFOHLEN
import { MojoAppLayout } from '@gkeferstein/design'

// Statt manueller Kombination von MojoShell, MojoTopbar, UnifiedSidebar
```

**Bewertung:** 4.5/5 ✅ **Vorbildlich**

---

## 6. Multitenancy

### Status: ✅ **Sehr gut**

#### Verwendung von @gkeferstein/tenant

```typescript
// ✅ Korrekt verwendet
import { TenantContext } from '@gkeferstein/tenant';
```

#### Standard Headers

```typescript
// ✅ Korrekt implementiert
headers: {
  'x-tenant-id': tenantId,
  'x-service-name': 'accounts-api',
}
```

#### Vergleich mit payments.mojo

| Feature | payments.mojo | account.mojo | Status |
|---------|---------------|--------------|--------|
| `@gkeferstein/tenant` Package | ✅ | ✅ | ✅ |
| Standard Headers | ✅ | ✅ | ✅ |
| Tenant Middleware | ✅ | ✅ (Custom) | ✅ |

**Bewertung:** 5/5 ✅ **Perfekt**

---

## 7. Health Check Standards

### Status: ⚠️ **Teilweise konform**

#### Aktuell (account.mojo)

```typescript
// ✅ Gut: Mehrere Endpoints
GET /health              // Simple
GET /health/detailed     // Detailed
GET /ready              // Readiness Probe
GET /live               // Liveness Probe
```

#### Problem: API-Pfad

```typescript
// ❌ AKTUELL
GET /api/v1/health
GET /api/v1/health/detailed
GET /api/v1/ready
GET /api/v1/live

// ✅ SOLLTE SEIN (gemäß Konvention)
GET /health              // Oder /api/health
GET /health/detailed     // Oder /api/health/detailed
GET /ready              // Oder /api/ready
GET /live               // Oder /api/live
```

#### Response Format

```typescript
// ✅ GUT - Enthält alle erforderlichen Felder
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  timestamp: string,
  version: string,
  uptime: number,
  services: {
    database: 'up' | 'down'
  }
}
```

**Bewertung:** 3.5/5 ⚠️

---

## 8. Docker Healthchecks

### Status: ✅ **Gut**

#### Aktuell (account.mojo)

```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

#### Vergleich mit Konvention

| Kriterium | Konvention | account.mojo | Status |
|-----------|------------|--------------|--------|
| Test Command | `wget` oder `curl` | ✅ `wget` | ✅ |
| Interval | 30s | ✅ 30s | ✅ |
| Timeout | 10s | ✅ 10s | ✅ |
| Retries | 3 | ✅ 3 | ✅ |
| Start Period | 40s | ✅ 40s | ✅ |

**Kleines Problem:** Verwendet `/api/v1/health` statt `/health` (siehe Abschnitt 3).

**Bewertung:** 4/5 ✅

---

## 9. Code-Struktur

### Status: ✅ **Sehr gut**

#### Projektstruktur

```
account.mojo/
├── apps/
│   ├── api/           # Fastify Backend
│   └── web/           # Next.js Frontend
├── packages/
│   └── shared/        # Shared Types & Schemas
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.staging.yml
│   └── docker-compose.prod.yml
└── docs/
```

**Vergleich mit payments.mojo:**

| Kriterium | payments.mojo | account.mojo | Status |
|-----------|---------------|--------------|--------|
| Monorepo-Struktur | ✅ | ✅ | ✅ |
| Separate API/Web | ✅ | ✅ | ✅ |
| Shared Package | ✅ | ✅ | ✅ |
| Infra-Verzeichnis | ✅ | ✅ | ✅ |

**Bewertung:** 5/5 ✅ **Perfekt**

---

## 10. TypeScript & Code-Qualität

### Status: ✅ **Sehr gut**

#### TypeScript Config

```json
// ✅ Gut: Strict Mode
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

#### Naming Conventions

- ✅ camelCase für Variablen/Funktionen
- ✅ PascalCase für Klassen/Interfaces
- ✅ SCREAMING_SNAKE_CASE für Constants
- ✅ kebab-case für Dateinamen

**Bewertung:** 5/5 ✅ **Perfekt**

---

## Priorisierte Action Items

### 🔴 Kritisch (Sofort beheben)

1. **Basic Auth in Staging aktivieren**
   - [ ] `docker-compose.staging.yml` anpassen
   - [ ] `staging-basicauth@file` Middleware hinzufügen
   - [ ] `staging-headers@file` Middleware hinzufügen

2. **Clerk-Routen explizit ausnehmen**
   - [ ] Separate Router für `/sign-in`, `/sign-up`, `/api/webhook`, `/api/clerk`
   - [ ] Priority 20 für Clerk-Router (ohne Basic Auth)
   - [ ] Priority 1 für Main-Router (mit Basic Auth)

3. **Staging Domain korrigieren**
   - [ ] `account.staging.*` → `accounts.staging.*` (Plural)
   - [ ] Alle Traefik Labels anpassen
   - [ ] CI/CD Health Checks anpassen
   - [ ] README.md und `.cursorrules` aktualisieren

### 🟡 Wichtig (Bald beheben)

4. **API-Versionierung entfernen**
   - [ ] `/api/v1/*` → `/api/*` migrieren
   - [ ] Health Checks auf `/api/health` oder `/health` ändern
   - [ ] Frontend API-Client anpassen
   - [ ] Dokumentation aktualisieren

5. **CI/CD Secrets-Namen standardisieren**
   - [ ] `PROD_SERVER_SSH_KEY` → `PRODUCTION_SSH_KEY`
   - [ ] `PROD_SERVER_HOST` → `PRODUCTION_SERVER`

6. **Deployment-Script in Pipeline einbetten**
   - [ ] Blue/Green Script direkt in CI/CD Workflow einbetten
   - [ ] Externes Script entfernen (oder als Fallback behalten)

### 🟢 Nice-to-Have (Später optimieren)

7. **MojoAppLayout verwenden**
   - [ ] Manuelle Kombination durch `MojoAppLayout` ersetzen
   - [ ] Gemäß CODING_STANDARDS.md Section 1.4

8. **Health Check Basic Auth Handling**
   - [ ] HTTP 401 für Staging akzeptieren
   - [ ] CI/CD Health Checks anpassen

---

## Zusammenfassung nach Kategorien

| Kategorie | Bewertung | Status |
|-----------|-----------|--------|
| **Domain-Konventionen** | 3/5 | ⚠️ Teilweise konform |
| **Docker Compose & Traefik** | 2/5 | ❌ Kritisch |
| **API-Endpoints** | 2/5 | ⚠️ Nicht konform |
| **CI/CD Pipeline** | 4/5 | ✅ Sehr gut |
| **Design System** | 4.5/5 | ✅ Vorbildlich |
| **Multitenancy** | 5/5 | ✅ Perfekt |
| **Health Checks** | 3.5/5 | ⚠️ Teilweise konform |
| **Docker Healthchecks** | 4/5 | ✅ Gut |
| **Code-Struktur** | 5/5 | ✅ Perfekt |
| **TypeScript & Qualität** | 5/5 | ✅ Perfekt |

**Gesamt:** 37.5/50 = **75%** ⚠️

---

## Referenzen

- [platform.mojo CODING_STANDARDS.md](../../../platform.mojo/docs/CODING_STANDARDS.md)
- [platform.mojo STAGING_SERVER_CONVENTION.md](../../../platform.mojo/docs/STAGING_SERVER_CONVENTION.md)
- [payments.mojo docker-compose.staging.yml](../../../payments.mojo/docker-compose.staging.yml)
- [account.mojo README.md](../README.md)

---

**Zuletzt aktualisiert:** 2025-01-03

