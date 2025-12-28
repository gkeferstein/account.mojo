# Port-Konfiguration

**Projekt:** accounts.mojo  
**Domain:** dev.account.mojo-institut.de (Dev) / accounts.mojo-institut.de (Prod)  
**Status:** 🚀 Docker + Traefik (File Provider)

## Service-Details

| Service | Container | Interner Port | Traefik Route | Beschreibung |
|---------|-----------|---------------|---------------|--------------|
| **Frontend** | accounts-web | 3000 | `dev.account.mojo-institut.de` | Next.js 15 App Router |
| **API** | accounts-api | 3001 | `dev.account.mojo-institut.de/api/*` | Fastify REST API |
| **PostgreSQL** | accounts-db | 5432 | Nur intern | Datenbank |

## Öffentlicher Zugriff (HTTPS)

### Development
- **Frontend:** https://dev.account.mojo-institut.de/
- **API:** https://dev.account.mojo-institut.de/api/v1/
- **API Health:** https://dev.account.mojo-institut.de/api/v1/health

### Production
- **Frontend:** https://accounts.mojo-institut.de/
- **API:** https://accounts.mojo-institut.de/api/v1/
- **API Health:** https://accounts.mojo-institut.de/api/v1/health

## Lokaler Zugriff (Development)

```bash
# Mit docker-compose.dev.yml
curl http://localhost:3000/       # Frontend
curl http://localhost:3001/api/v1/health # API
psql -h localhost -p 5433 -U accounts accounts_db  # PostgreSQL
```

## Docker + Traefik Routing

Das Projekt verwendet das serverseitige Traefik-Setup mit File Provider:

- **Netzwerk:** `mojo-accounts-network`
- **Traefik Config:** `/root/infrastructure/traefik/config/accounts-routers.yml`
- **SSL:** Let's Encrypt via Traefik

### Start-Befehle

```bash
# Development
cd /root/projects/accounts.mojo
make dev

# Production
make prod

# Logs anzeigen
make logs

# Status prüfen
docker compose -f infra/docker-compose.yml ps
```

### Netzwerk-Setup

```bash
# Netzwerk erstellen (einmalig)
make network

# Traefik mit Netzwerk verbinden (einmalig)
make traefik-connect
```

**Zuletzt aktualisiert:** 2024-12-28
