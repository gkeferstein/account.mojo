# Deployment Guide - accounts.mojo

Dieses Dokument beschreibt den Deployment-Prozess für accounts.mojo v0.3.0.

## Pre-Deployment Checklist

### 1. Environment Variablen

Erstelle eine `.env` Datei basierend auf `env.example` und setze alle **Production** Werte:

#### ✅ Required für Production

```bash
# Database
POSTGRES_USER=accounts
POSTGRES_PASSWORD=<sicheres-passwort-generieren>
POSTGRES_DB=accounts_db
DATABASE_URL=postgresql://accounts:<passwort>@db:5432/accounts_db

# Clerk Authentication (Production Keys!)
CLERK_SECRET_KEY=sk_live_<von-clerk-dashboard>
CLERK_PUBLISHABLE_KEY=pk_live_<von-clerk-dashboard>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_<von-clerk-dashboard>

# Clerk Webhooks
CLERK_WEBHOOK_SECRET=whsec_<von-clerk-webhook-endpoint>

# Frontend URLs (Production)
FRONTEND_URL=https://accounts.mojo-institut.de
NEXT_PUBLIC_API_URL=https://accounts.mojo-institut.de

# External Services - Payments
PAYMENTS_API_URL=https://payments.mojo-institut.de/api/v1
PAYMENTS_API_KEY=<service-api-key-von-payments.mojo>

# External Services - CRM (kontakte.mojo)
CRM_API_URL=https://kontakte.mojo-institut.de/api/v1
CRM_API_KEY=<service-api-key-von-kontakte.mojo>
CRM_TENANT_SLUG=mojo

# Mock Mode (MUST be false in production!)
MOCK_EXTERNAL_SERVICES=false

# Webhook Secrets (generate: openssl rand -hex 32)
WEBHOOK_SECRET_PAYMENTS=<generiertes-secret>
WEBHOOK_SECRET_CRM=<generiertes-secret>

# Internal API Secret (generate: openssl rand -hex 32)
INTERNAL_API_SECRET=<generiertes-secret>

# Email (optional)
EMAIL_FROM=noreply@mojo-institut.de
SENDGRID_API_KEY=<optional-sendgrid-key>

# Environment
NODE_ENV=production
```

#### 🔐 Secret Generation

```bash
# Webhook Secrets generieren
openssl rand -hex 32  # Für WEBHOOK_SECRET_PAYMENTS
openssl rand -hex 32  # Für WEBHOOK_SECRET_CRM
openssl rand -hex 32  # Für INTERNAL_API_SECRET

# Datenbank-Passwort generieren
openssl rand -base64 32
```

#### ⚠️ Wichtige Hinweise

1. **Clerk Keys**: Verwende **LIVE Keys** (`sk_live_...`, `pk_live_...`) für Production, nicht Test Keys!
2. **Webhook Secrets**: Diese müssen mit den konfigurierten Secrets in `payments.mojo` und `kontakte.mojo` übereinstimmen
3. **API Keys**: `PAYMENTS_API_KEY` und `CRM_API_KEY` müssen mit den `SERVICE_API_KEY` Werten in den jeweiligen Services übereinstimmen
4. **MOCK_EXTERNAL_SERVICES**: Muss in Production **immer** `false` sein!

### 2. Docker Netzwerk

```bash
# Netzwerk erstellen (falls noch nicht vorhanden)
make network

# Traefik mit Netzwerk verbinden (falls noch nicht verbunden)
make traefik-connect
```

### 3. DNS Konfiguration

Stelle sicher, dass die folgenden DNS-Einträge konfiguriert sind:

- `accounts.mojo-institut.de` → Server IP (A-Record)
- `dev.account.mojo-institut.de` → Server IP (A-Record, optional für Dev)

### 4. Traefik Konfiguration

Die Traefik Labels sind bereits in `docker-compose.yml` konfiguriert. Stelle sicher, dass:

- Traefik läuft und auf `websecure` Entrypoint lauscht
- Let's Encrypt Certificate Resolver (`letsencrypt`) konfiguriert ist
- Traefik mit `mojo-network` verbunden ist

## Deployment Prozess

### Schritt 1: Repository vorbereiten

```bash
cd /root/projects/accounts.mojo

# Aktuellen Stand pullen
git pull origin main

# Branch für Release (optional)
git checkout -b release/v0.3.0
```

### Schritt 2: Environment konfigurieren

```bash
# .env Datei erstellen/aktualisieren
cp env.example .env
nano .env  # Alle Production-Werte eintragen (siehe Checkliste oben)
```

### Schritt 3: Build testen

```bash
# Lokalen Build testen (optional, aber empfohlen)
make build
```

### Schritt 4: Production Deployment

```bash
# Production Container starten (baut Images neu)
make prod

# Migrationen ausführen
make migrate

# Logs überwachen
make logs

# Oder spezifische Service-Logs
make logs-api
make logs-web
```

### Schritt 5: Health Checks

```bash
# API Health Check
curl https://accounts.mojo-institut.de/api/v1/health

# Detailed Health Check
curl https://accounts.mojo-institut.de/api/v1/health/detailed

# Frontend prüfen
curl -I https://accounts.mojo-institut.de/
```

## Post-Deployment Checklist

- [ ] Health Checks schlagen erfolgreich an
- [ ] Frontend ist erreichbar und lädt
- [ ] API Endpoints antworten korrekt
- [ ] Clerk Authentication funktioniert
- [ ] Webhooks von Clerk, payments.mojo und kontakte.mojo funktionieren
- [ ] Datenbank-Migrationen erfolgreich
- [ ] Logs zeigen keine kritischen Fehler

## Rollback Prozess

Falls ein Rollback notwendig ist:

```bash
# Container stoppen
make down

# Vorherige Version deployen (z.B. v0.2.0)
git checkout v0.2.0
make prod
make migrate
```

## Troubleshooting

### Container startet nicht

```bash
# Logs prüfen
make logs

# Container-Status prüfen
docker ps -a

# Environment Variablen prüfen
docker exec accounts-api env | grep CLERK
```

### Datenbank-Verbindungsfehler

```bash
# Datenbank-Container Status prüfen
docker ps | grep accounts-db

# Datenbank-Logs
docker logs accounts-db

# Datenbank-Verbindung testen
docker exec accounts-db psql -U accounts -d accounts_db -c "SELECT 1;"
```

### Health Check schlägt fehl

```bash
# API-Logs prüfen
make logs-api

# Direkter Health Check im Container
docker exec accounts-api wget -qO- http://localhost:3001/api/v1/health

# Prisma Client generieren (falls notwendig)
docker exec accounts-api npx prisma generate
```

### Webhook-Probleme

```bash
# Webhook Events log prüfen (Internal API)
curl -H "X-Internal-Token: ${INTERNAL_API_SECRET}" \
  https://accounts.mojo-institut.de/api/internal/webhook-events

# Webhook Secrets prüfen (müssen mit anderen Services übereinstimmen!)
echo $WEBHOOK_SECRET_PAYMENTS
echo $WEBHOOK_SECRET_CRM
```

## Update Prozess

Für Updates nach v0.3.0:

```bash
# Neue Version pullen
git pull origin main

# Container neu bauen und starten
make prod

# Migrationen prüfen/ausführen
make migrate

# Logs überwachen
make logs
```

## Monitoring

### Logs

```bash
# Alle Logs
make logs

# API-Logs
make logs-api

# Web-Logs
make logs-web

# Datenbank-Logs
docker logs accounts-db
```

### Health Endpoints

- `/api/v1/health` - Einfacher Health Check
- `/api/v1/health/detailed` - Detaillierter Health Check mit Service-Status
- `/api/v1/ready` - Kubernetes Readiness Probe
- `/api/v1/live` - Kubernetes Liveness Probe

### Internal API (Monitoring)

```bash
# Health + Stats
curl -H "X-Internal-Token: ${INTERNAL_API_SECRET}" \
  https://accounts.mojo-institut.de/api/internal/health

# Webhook Event Log
curl -H "X-Internal-Token: ${INTERNAL_API_SECRET}" \
  https://accounts.mojo-institut.de/api/internal/webhook-events
```

## Wartung

### Datenbank-Backup

```bash
# Backup erstellen
docker exec accounts-db pg_dump -U accounts accounts_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup wiederherstellen
docker exec -i accounts-db psql -U accounts accounts_db < backup_YYYYMMDD_HHMMSS.sql
```

### Prisma Studio (Development)

```bash
# Prisma Studio öffnen (nur für Development/Testing!)
make studio
```

---

**Zuletzt aktualisiert:** 2024-12-29 (v0.3.0)

