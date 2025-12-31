# Pre-Deployment Checklist - accounts.mojo v0.3.0

**Datum:** 2024-12-29  
**Zweck:** Umfassende Prüfung aller Aspekte vor dem Live-Gang

---

## 🔴 Kritische Prüfungen (MUSS erfüllt sein)

### 1. Environment Variables

- [ ] **Alle Required Environment Variables gesetzt**
  - `DATABASE_URL` - Production Database Connection String
  - `CLERK_SECRET_KEY` - **LIVE Key** (`sk_live_...`), NICHT Test Key!
  - `CLERK_PUBLISHABLE_KEY` - **LIVE Key** (`pk_live_...`)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - **LIVE Key**
  - `CLERK_WEBHOOK_SECRET` - Von Clerk Dashboard
  - `FRONTEND_URL` - Production URL (`https://account.mojo-institut.de`)
  - `NEXT_PUBLIC_API_URL` - Production URL
  - `PAYMENTS_API_URL` - Production URL
  - `PAYMENTS_API_KEY` - Service API Key (muss mit payments.mojo übereinstimmen)
  - `CRM_API_URL` - Production URL
  - `CRM_API_KEY` - Service API Key (muss mit kontakte.mojo übereinstimmen)
  - `WEBHOOK_SECRET_PAYMENTS` - Muss mit payments.mojo übereinstimmen
  - `WEBHOOK_SECRET_CRM` - Muss mit kontakte.mojo übereinstimmen
  - `INTERNAL_API_SECRET` - Sicheres Secret (openssl rand -hex 32)

- [ ] **Keine Dev-Defaults in Production**
  - ❌ `MOCK_EXTERNAL_SERVICES` muss `false` sein
  - ❌ Keine `dev-` oder `test_` Prefixe in Secrets
  - ❌ Keine hardcoded Defaults wie `'dev-webhook-secret-payments'`
  - ✅ `NODE_ENV=production` gesetzt

- [ ] **Validation läuft**
  - Environment Validation wird beim Start ausgeführt
  - Missing Variables führen zu process.exit(1)

**Prüfung:**
```bash
# Prüfe .env Datei
cat .env | grep -E "(CLERK_SECRET_KEY|MOCK_EXTERNAL_SERVICES|NODE_ENV)"

# Sollte zeigen:
# CLERK_SECRET_KEY=sk_live_...  # NICHT sk_test_!
# MOCK_EXTERNAL_SERVICES=false
# NODE_ENV=production
```

---

### 2. Secrets Management

- [ ] **Keine Secrets im Code**
  - ✅ Keine hardcoded API Keys
  - ✅ Keine Passwörter in Code
  - ✅ Alle Secrets aus Environment Variables

- [ ] **Secret Rotation Ready**
  - Secrets können über Environment Variables aktualisiert werden
  - Keine Restarts erforderlich für Secret-Änderungen (außer bei Docker Restart)

- [ ] **Webhook Secrets synchronisiert**
  - `WEBHOOK_SECRET_PAYMENTS` = `WEBHOOK_SECRET_ACCOUNTS` in payments.mojo
  - `WEBHOOK_SECRET_CRM` = `WEBHOOK_SECRET` in kontakte.mojo
  - `PAYMENTS_API_KEY` = `SERVICE_API_KEY` in payments.mojo
  - `CRM_API_KEY` = `SERVICE_API_KEY` in kontakte.mojo

---

### 3. Database

- [ ] **Migrations bereit**
  - Alle Migrations im `prisma/migrations` Ordner
  - Migrations wurden getestet (dev/staging)
  - Keine Breaking Changes ohne entsprechende Migrations

- [ ] **Database Backup vorhanden**
  - Backup-Strategie dokumentiert
  - Restore-Prozess getestet

- [ ] **Connection Pooling konfiguriert**
  - Prisma Connection Pool Settings angemessen
  - Max Connections Limits gesetzt

**Prüfung:**
```bash
# Migrations prüfen
cd apps/api
npx prisma migrate status

# Database Connection testen
docker exec accounts-api npx prisma db execute --stdin <<< "SELECT 1;"
```

---

### 4. Docker Configuration

- [ ] **Production Dockerfile verwendet**
  - `apps/api/Dockerfile` (nicht Dockerfile.dev)
  - `apps/web/Dockerfile` (nicht Dockerfile.dev)
  - Multi-stage builds für optimale Image-Größe

- [ ] **Docker Compose Production**
  - `infra/docker-compose.prod.yml` wird verwendet
  - Restart Policy: `unless-stopped`
  - Log Rotation konfiguriert (max-size, max-file)
  - Health Checks vorhanden

- [ ] **Image Tags**
  - Version tags verwendet (nicht `latest`)
  - Images werden gebaut bevor deployt wird

**Prüfung:**
```bash
# Production Compose Datei prüfen
cat infra/docker-compose.prod.yml

# Images prüfen
docker images | grep accounts
```

---

### 5. Security

- [ ] **CORS korrekt konfiguriert**
  - Nur Production Frontend URL erlaubt
  - Kein `localhost:3000` in Production
  - Credentials: true gesetzt

- [ ] **Security Headers**
  - Helmet aktiviert
  - Content-Security-Policy (Frontend, nicht API)
  - Rate Limiting aktiviert (100 req/min)

- [ ] **Authentication**
  - Clerk JWT Verification aktiviert
  - Mock Auth nur in Development (mit Warning-Log)
  - Internal API Token Authentication mit Timing-Safe Comparison

- [ ] **Webhook Security**
  - Signature Verification implementiert
  - Raw Body vor Parsing erhalten
  - Idempotency Checks vorhanden

---

### 6. Error Handling & Logging

- [ ] **Structured Logging**
  - Keine `console.log/error/warn` in Production Code
  - Pino/Structured Logging verwendet
  - JSON Logs in Production

- [ ] **Error Messages**
  - Generic Error Messages in Production
  - Keine Stack Traces in Responses
  - Keine sensiblen Informationen in Error Messages
  - Details nur in Logs

- [ ] **Graceful Shutdown**
  - SIGTERM/SIGINT Handling implementiert
  - Database Connections werden geschlossen
  - In-flight Requests werden abgearbeitet

**Prüfung:**
```bash
# Suche nach console.* (sollte minimal sein)
grep -r "console\." apps/api/src --exclude-dir=node_modules | wc -l

# Prüfe Error Handler
cat apps/api/src/middleware/error-handler.ts | grep -A 5 "isDevelopment"
```

---

## 🟡 Wichtige Prüfungen (Sollte erfüllt sein)

### 7. Health Checks

- [ ] **Health Endpoints vorhanden**
  - `/api/v1/health` - Simple Health Check
  - `/api/v1/health/detailed` - Mit Service-Status
  - `/api/v1/ready` - Readiness Probe
  - `/api/v1/live` - Liveness Probe

- [ ] **Health Checks funktionieren**
  - Database Connection wird geprüft
  - Korrekte Status Codes (503 wenn unhealthy)
  - Response Times akzeptabel (< 1s)

**Prüfung:**
```bash
# Health Checks testen
curl https://account.mojo-institut.de/api/v1/health
curl https://account.mojo-institut.de/api/v1/health/detailed
curl https://account.mojo-institut.de/api/v1/ready
curl https://account.mojo-institut.de/api/v1/live
```

---

### 8. External Services

- [ ] **External Service URLs korrekt**
  - `PAYMENTS_API_URL` - Production URL
  - `CRM_API_URL` - Production URL
  - Keine localhost URLs

- [ ] **API Keys validiert**
  - Keys funktionieren mit External Services
  - Keys haben richtige Berechtigungen
  - Keys sind nicht abgelaufen

- [ ] **Retry Logic vorhanden**
  - HTTP Clients haben Retry-Logic
  - Timeouts konfiguriert
  - Exponential Backoff implementiert

- [ ] **Fallback Strategien**
  - Cache wird verwendet wenn External Services down
  - Graceful Degradation implementiert
  - Error Handling für Service-Ausfälle

---

### 9. Monitoring & Observability

- [ ] **Logs konfiguriert**
  - Log Rotation aktiviert
  - Log Levels korrekt (info in Production, debug in Dev)
  - Structured Logging (JSON)

- [ ] **Metrics (optional)**
  - Health Check Metrics
  - Request Metrics (wenn verfügbar)
  - Error Rates (wenn verfügbar)

- [ ] **Alerting Setup (optional)**
  - Health Check Failures
  - High Error Rates
  - Database Connection Issues

---

### 10. Performance

- [ ] **Caching**
  - Profile Cache (TTL: 5 min)
  - Billing Cache (TTL: 1 min)
  - Entitlement Cache (TTL: 1 min)
  - Cache Fallback bei Service-Fehlern

- [ ] **Rate Limiting**
  - 100 Requests/Minute pro IP
  - Angemessene Limits für Production

- [ ] **Database Queries**
  - Keine N+1 Queries
  - Indices vorhanden für häufige Queries
  - Connection Pooling aktiviert

---

### 11. Documentation

- [ ] **Dokumentation aktuell**
  - README.md mit aktuellen Informationen
  - DEPLOYMENT.md mit vollständigen Anweisungen
  - CHANGELOG.md mit v0.3.0 Release Notes
  - API Documentation (wenn vorhanden)

- [ ] **Environment Variables dokumentiert**
  - `env.example` ist aktuell
  - Alle Required Variables erklärt
  - Secrets Generation dokumentiert

---

## 🔵 Nice-to-Have Prüfungen

### 12. Testing

- [ ] **Tests vorhanden (wenn möglich)**
  - Unit Tests für kritische Funktionen
  - Integration Tests für API Endpoints
  - Health Check Tests

### 13. Backup & Disaster Recovery

- [ ] **Backup-Strategie**
  - Database Backups automatisiert
  - Backup-Restore getestet
  - Backup-Retention definiert

- [ ] **Disaster Recovery Plan**
  - Rollback-Prozess dokumentiert
  - Recovery Time Objectives definiert
  - Recovery Point Objectives definiert

---

## 📋 Deployment-Kommandos Checkliste

Vor dem Deployment:

```bash
# 1. Code aktuell
git pull origin main
git log --oneline -5  # Prüfe letzte Commits

# 2. Environment Variables prüfen
cat .env | grep -E "(NODE_ENV|MOCK_EXTERNAL_SERVICES|CLERK_SECRET_KEY)"

# 3. Docker Images bauen
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml build

# 4. Health Checks lokal testen (falls möglich)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d
sleep 10
curl http://localhost:3001/api/v1/health
docker compose -f infra/docker-compose.yml down

# 5. Deployment ausführen
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build

# 6. Migrations ausführen
docker exec accounts-api npx prisma migrate deploy

# 7. Health Checks nach Deployment
sleep 30
curl https://account.mojo-institut.de/api/v1/health
curl https://account.mojo-institut.de/api/v1/health/detailed

# 8. Logs überwachen
docker logs -f accounts-api
docker logs -f accounts-web
```

---

## ⚠️ Bekannte Issues / Limitationen

- [ ] **Dokumentierte Issues überprüft**
  - Siehe CHANGELOG.md "Known Limitations"
  - Workarounds bekannt
  - Fixes geplant

---

## 🚨 Rollback-Prozess

Falls Probleme auftreten:

1. **Container stoppen:**
   ```bash
   docker compose -f infra/docker-compose.yml down
   ```

2. **Vorherige Version deployen:**
   ```bash
   git checkout <vorherige-version-tag>
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build
   ```

3. **Migrations rollback (falls notwendig):**
   ```bash
   # Manuell prüfen und ggf. Migrations zurücksetzen
   docker exec accounts-api npx prisma migrate status
   ```

---

**Erstellt:** 2024-12-29  
**Version:** 1.0  
**Nächste Prüfung:** Vor jedem Production Deployment

