# CI/CD Pipeline Dokumentation - accounts.mojo

## Übersicht

Dieses Projekt verwendet zwei separate CI/CD Pipelines:

1. **ci-main.yml** - Für `main` Branch (~5-10 Minuten)
2. **ci-release.yml** - Für Version Tags wie `v0.3.0` (30-45 Minuten)

## Main Pipeline (ci-main.yml)

**Trigger:** Push zu `main` Branch

**Ziele:**
- ✅ Schnelle Feedback-Schleife (~5-10 Minuten)
- ✅ Basis-Qualitätsprüfungen
- ✅ Automatisches Deployment zu Dev (optional)

**Schritte:**
1. **Code Quality Checks** (parallel)
   - TypeScript Compile Check (API & Web)
   - ESLint (API & Web)
   - Security Audit (nur High/Critical, Warnung)

2. **Tests** (parallel)
   - Unit Tests mit Coverage (Warnung bei Fehlern)

3. **Database Checks** (parallel)
   - Prisma Migration Status Check
   - Schema Format Validation

4. **Build & Push Docker Images**
   - API Image: `ghcr.io/{repo}-api:latest`, `ghcr.io/{repo}-api:{sha}`
   - Web Image: `ghcr.io/{repo}-web:latest`, `ghcr.io/{repo}-web:{sha}`

5. **Auto-Deploy to Dev** (optional, nur bei main)
   - Automatisches Deployment nach erfolgreichen Tests
   - Prisma Migrations werden ausgeführt
   - Health Checks

6. **Notifications**
   - Email bei Pipeline-Fehlern (optional)

## Release Pipeline (ci-release.yml)

**Trigger:** Push von Tags im Format `v0.3.0` oder manuell via `workflow_dispatch`

**Ziele:**
- ✅ Umfassende Qualitätssicherung
- ✅ Production-Ready Validierung
- ✅ Automatisches Release & Deployment

**Schritte:**
1. **Prepare Release**
   - Version-Extraktion aus Tag oder Input
   - Version-Validierung

2. **Strict Code Quality** (parallel)
   - Strict TypeScript Checks (API & Web)
   - ESLint (API & Web)
   - Dependency Vulnerability Scans
   - License Compliance Checks

3. **Comprehensive Tests** (parallel)
   - Unit Tests mit Coverage
   - Test Coverage Reports

4. **Security Scans** (parallel)
   - npm Audit (Detailed)
   - Trivy Security Scan (File System)
   - Secrets Scanning (TruffleHog)

5. **Database Migration Tests**
   - Database Backup vor Migration
   - Migration Execution
   - Migration Status Verification
   - Schema Validation

6. **Build & Push Release Images** (mit Signierung)
   - API Image mit Version Tags: `v0.3.0`, `0.3`, `{sha}`
   - Web Image mit Version Tags: `v0.3.0`, `0.3`, `{sha}`
   - Image Signierung (cosign, optional)
   - Container Scanning (Trivy)

7. **Create GitHub Release**
   - Automatische Release-Erstellung
   - Changelog aus CHANGELOG.md
   - Automatische Release Notes
   - Docker Image Tags in Release Notes

8. **Deployment to Production**
   - Database Backup vor Migration
   - Deployment mit Version Tags
   - Automatische DB-Migrationen (Prisma)
   - Health Checks
   - Rollback bei Fehlern

9. **Notifications**
   - Email bei Release-Pipeline-Fehlern (optional)

## Benötigte GitHub Secrets

### Für Container Registry:
- `GHCR_TOKEN` - GitHub Container Registry Token (Personal Access Token mit `write:packages`)

### Für Deployment:
- `SSH_PRIVATE_KEY` - SSH Key für Production Deployment
- `DEPLOY_SERVER` - Production Server Adresse
- `DEPLOY_USER` - Production Server User (z.B. `root`)

### Für Development Deployment (optional):
- `DEPLOY_SSH_DEV` - SSH Key für Dev Deployment
- `DEPLOY_SERVER_DEV` - Dev Server Adresse

### Für Build:
- `NEXT_PUBLIC_API_URL` - API URL für Next.js Build (optional, Default: `https://accounts.mojo-institut.de`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk Publishable Key für Next.js Build
- `NEXT_PUBLIC_PAYMENTS_API_URL` - Payments API URL für Next.js Build (optional, Default: `https://payments.mojo-institut.de/api`)

### Für Email-Notifications (optional):
- `EMAIL_USERNAME` - SMTP Username (z.B. Gmail)
- `EMAIL_PASSWORD` - SMTP Password oder App Password
- `EMAIL_RECIPIENT` - Empfänger-Email-Adresse

**Hinweis:** Falls Email-Notifications nicht konfiguriert sind, werden die Notification-Steps übersprungen (continue-on-error: true).

## Docker Image Tags

### Main Pipeline:
- API: `latest`, `{sha}`
- Web: `latest`, `{sha}`

### Release Pipeline:
- API: `v0.3.0`, `0.3`, `{sha}`
- Web: `v0.3.0`, `0.3`, `{sha}`

## Path-basierte Optimierungen

Die Main Pipeline ignoriert Änderungen an:
- `**.md` - Markdown-Dateien
- `.gitignore`
- `LICENSE`
- `docs/**`
- `scripts/**`
- `.github/**`

## Rollback-Strategie

Bei Release-Deployment:
1. Database Backup wird vor Migration erstellt
2. Bei Fehlern wird automatisch auf vorherige Version zurückgerollt
3. Health Checks müssen erfolgreich sein, bevor Deployment als erfolgreich gilt

## Manueller Trigger

Die Release-Pipeline kann manuell getriggert werden:
1. GitHub Actions → Workflows → "CI - Release Pipeline"
2. "Run workflow" → Version eingeben (z.B. `v0.3.0`)

## Unterschiede zu payments.mojo

- **Monorepo-Struktur**: `apps/api`, `apps/web`, `packages/shared`
- **Prisma**: Statt Knex für Datenbankmigrationen
- **Next.js**: Statt Vite für Frontend
- **Container-Namen**: `accounts-api`, `accounts-web`, `accounts-db`
- **Docker Compose**: `infra/docker-compose.yml` + `infra/docker-compose.prod.yml`
- **Health Check URL**: `https://accounts.mojo-institut.de/api/v1/health`

## Troubleshooting

### Pipeline schlägt fehl bei Tests
- Prüfe Test-Artifacts in GitHub Actions
- Lokale Tests ausführen: `npm test`

### Frontend-Build schlägt fehl
- Prüfe ob `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` Secret gesetzt ist
- Prüfe ob `@mojo/design` Package verfügbar ist

### Deployment schlägt fehl
- Prüfe SSH-Verbindung
- Prüfe Server-Logs: `docker logs accounts-api`
- Prüfe ob Environment Variables gesetzt sind

### Migrations schlagen fehl
- Prüfe Datenbank-Verbindung
- Prüfe ob `DATABASE_URL` korrekt ist
- Prüfe Migration Status: `docker exec accounts-api npx prisma migrate status`

### Email-Notifications funktionieren nicht
- Prüfe GitHub Secrets (EMAIL_USERNAME, EMAIL_PASSWORD, EMAIL_RECIPIENT)
- Für Gmail: App-Password verwenden, nicht normales Passwort

## Performance-Optimierungen

- Parallele Ausführung von Jobs wo möglich
- Docker Layer Caching (GitHub Actions Cache)
- npm Cache (GitHub Actions Cache)
- Path-basierte Ignorierung in Main Pipeline

