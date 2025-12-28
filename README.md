# MOJO Accounts - Customer Account Portal

Das zentrale Self-Service-Portal für MOJO-Kunden zur Verwaltung von:

- 👤 Profildaten (persönliche + Rechnungskontakt)
- 🏢 Tenant/Team-Mitgliedschaften (Multi-Tenancy)
- 💳 Abonnements und Berechtigungen
- 📄 Rechnungen und Billing Portal
- 🔔 Kommunikationseinstellungen
- 🔒 Sicherheitseinstellungen (via Clerk)
- 📊 DSGVO-Datenexport/-löschung

## 🏗 Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        Traefik Reverse Proxy                     │
│               dev.account.mojo-institut.de (Dev)                 │
│               accounts.mojo-institut.de (Prod)                   │
├─────────────┬─────────────┬─────────────────────────────────────┤
│    /        │   /api/*    │           (intern)                  │
│  Frontend   │   API       │         PostgreSQL                  │
│  (Next.js)  │  (Fastify)  │                                     │
│   :3000     │   :3001     │           :5432                     │
└─────────────┴─────────────┴─────────────────────────────────────┘
```

**Live URL:** https://dev.account.mojo-institut.de

## 🚀 Schnellstart

### Voraussetzungen

- Docker & Docker Compose
- Node.js 22+ (für lokale Entwicklung)
- Git

### 1. Repository klonen und konfigurieren

```bash
cd /root/projects/accounts.mojo

# Environment-Variablen kopieren
cp env.example .env

# Secrets anpassen
nano .env
```

### 2. Docker-Netzwerk erstellen

```bash
# Netzwerk für alle Accounts-Services
make network

# Traefik mit Netzwerk verbinden
make traefik-connect
```

### 3. Entwicklung starten

```bash
# Alles starten (mit Hot-Reload)
make dev

# Oder im Hintergrund
make dev-detached
```

### 4. Datenbank initialisieren

```bash
# Migrationen ausführen
make migrate

# Demo-Daten seeden (optional)
make seed
```

### 5. Aufrufen

- **Frontend:** http://localhost:3000
- **API:** http://localhost:3001/api/v1/health
- **Prisma Studio:** `make studio`

## 📁 Projektstruktur

```
accounts.mojo/
├── apps/
│   ├── api/                    # Fastify Backend
│   │   ├── src/
│   │   │   ├── routes/         # API Endpoints
│   │   │   ├── middleware/     # Auth, RBAC, Validation
│   │   │   ├── services/       # Business Logic
│   │   │   ├── clients/        # External Service Clients
│   │   │   └── lib/            # Prisma, Utils
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # DB Schema
│   │   │   └── seed.ts         # Demo Data
│   │   └── Dockerfile
│   └── web/                    # Next.js Frontend
│       ├── src/
│       │   ├── app/            # Pages
│       │   ├── components/     # UI Components
│       │   ├── lib/            # API Client, Utils
│       │   └── providers/      # Clerk, Tenant Context
│       └── Dockerfile
├── packages/
│   └── shared/                 # Shared Types, Schemas
├── infra/
│   ├── docker-compose.yml      # Base Compose
│   ├── docker-compose.dev.yml  # Dev Override
│   └── docker-compose.prod.yml # Prod Override
├── docs/
│   └── PORT.md                 # Port-Dokumentation
├── env.example                 # Environment Template
├── Makefile                    # Common Commands
└── README.md
```

## 🔌 API Endpoints

### Öffentlich

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/v1/health` | GET | Health Check |

### Authentifiziert (Clerk JWT)

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/v1/me` | GET | Session + Tenant Info |
| `/api/v1/tenants/switch` | POST | Tenant wechseln |
| `/api/v1/tenants` | GET/POST | Tenants auflisten/erstellen |
| `/api/v1/tenants/:id` | GET/PATCH | Tenant Details |
| `/api/v1/tenants/:id/invite` | POST | Mitglied einladen |
| `/api/v1/tenants/:id/members/:mid/role` | POST | Rolle ändern |
| `/api/v1/profile` | GET/PATCH | Profil (CRM-backed) |
| `/api/v1/preferences` | GET/PATCH | Einstellungen |
| `/api/v1/billing/subscription` | GET | Abo-Status |
| `/api/v1/billing/invoices` | GET | Rechnungen |
| `/api/v1/billing/portal` | POST | Stripe Portal URL |
| `/api/v1/entitlements` | GET | Berechtigungen |
| `/api/v1/data/export-request` | POST | DSGVO Export |
| `/api/v1/data/delete-request` | POST | DSGVO Löschung |

### Webhooks

| Endpoint | Beschreibung |
|----------|--------------|
| `/api/v1/webhooks/payments` | Payment Events (Stripe) |
| `/api/v1/webhooks/crm` | CRM Events |

## 🔐 Authentifizierung

Das Projekt verwendet **Clerk** für Authentifizierung:

1. Frontend: ClerkProvider mit JWT
2. Backend: JWT-Verifizierung via `@clerk/backend`
3. Multi-Tenancy: Clerk Organizations → Tenant Mapping

### Rollen

| Rolle | Beschreibung |
|-------|--------------|
| `owner` | Voller Zugriff, kann nicht entfernt werden |
| `admin` | Kann Mitglieder verwalten |
| `member` | Standard-Zugriff |
| `billing_admin` | Nur Billing-Zugriff |
| `support_readonly` | Nur Lesen |

## 🐳 Deployment

### Production (Hetzner)

```bash
# 1. SSH auf Server
ssh root@your-server

# 2. Projekt klonen
cd /root/projects
git clone <repo-url> accounts.mojo
cd accounts.mojo

# 3. Environment konfigurieren
cp env.example .env
nano .env  # Secrets eintragen

# 4. Netzwerk erstellen
make network
make traefik-connect

# 5. Production starten
make prod

# 6. Migrationen
make migrate
```

### DNS

A-Record für `accounts.mojo-institut.de` → Server-IP

## 🧪 Entwicklung

### Lokale Entwicklung (ohne Docker)

```bash
# Dependencies installieren
make install

# Shared Package bauen
npm run build:shared

# API starten
cd apps/api
npm run dev

# Frontend starten (neues Terminal)
cd apps/web
npm run dev
```

### Datenbank-Migrationen

```bash
# Neue Migration erstellen
cd apps/api
npx prisma migrate dev --name <migration-name>

# Migration auf Production anwenden
make migrate
```

## 📝 Wichtige Befehle

```bash
make dev          # Development starten
make prod         # Production starten
make down         # Container stoppen
make logs         # Logs anzeigen
make migrate      # DB-Migrationen
make seed         # Demo-Daten
make studio       # Prisma Studio
make clean        # Alles aufräumen
```

## 🔄 Integrationen

### payments.mojo-institut.de

- Subscription-Status
- Entitlements
- Invoices
- Billing Portal Session

### kontakte.mojo-institut.de

- Profildaten
- Consents

Beide Clients haben einen **Mock-Modus** für lokale Entwicklung:

```bash
MOCK_EXTERNAL_SERVICES=true
```

---

**Zuletzt aktualisiert:** 2024-12-28
