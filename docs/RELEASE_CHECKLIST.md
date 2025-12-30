# Release Checklist für v0.3.0

## ✅ Abgeschlossen

- [x] Version in allen `package.json` Dateien auf 0.3.0 aktualisiert
- [x] CHANGELOG.md mit v0.3.0 Release Notes erstellt
- [x] Production Docker Compose Override (`infra/docker-compose.prod.yml`) erstellt
- [x] Development Docker Compose Override (`infra/docker-compose.dev.yml`) erstellt
- [x] Deployment Guide (`docs/DEPLOYMENT.md`) mit vollständiger Checkliste erstellt
- [x] README.md mit Versionsnummer und Links zu neuen Dokumenten aktualisiert

## 📋 Pre-Release (zu erledigen vor dem Live-Schalten)

### Code & Repository
- [ ] Alle Änderungen committen
- [ ] Release Branch erstellen (optional): `git checkout -b release/v0.3.0`
- [ ] Git Tag erstellen: `git tag -a v0.3.0 -m "Release v0.3.0"`

### Testing
- [ ] Build im Docker-Container testen (`make build` im Container)
- [ ] Health Checks testen (`/api/v1/health`, `/api/v1/health/detailed`)
- [ ] Frontend manuell testen (lokale Entwicklung)
- [ ] API Endpoints testen (mindestens kritische Endpoints)

### Environment & Secrets
- [ ] Production `.env` Datei erstellen/kontrollieren
- [ ] Alle Environment-Variablen gemäß `docs/DEPLOYMENT.md` Checkliste prüfen
- [ ] Clerk Production Keys konfiguriert (`sk_live_...`, `pk_live_...`)
- [ ] Webhook Secrets generiert und mit anderen Services synchronisiert
- [ ] API Keys für payments.mojo und kontakte.mojo konfiguriert
- [ ] `MOCK_EXTERNAL_SERVICES=false` für Production gesetzt

### Infrastructure
- [ ] Docker Netzwerk (`mojo-network`) existiert
- [ ] Traefik mit Netzwerk verbunden
- [ ] DNS-Einträge konfiguriert (`accounts.mojo-institut.de`)
- [ ] SSL-Zertifikate (Let's Encrypt) funktionieren

## 🚀 Deployment

### Schritt-für-Schritt Deployment

1. **Repository aktualisieren**
   ```bash
   cd /root/projects/accounts.mojo
   git pull origin main  # oder release/v0.3.0
   git checkout v0.3.0  # wenn Tag erstellt wurde
   ```

2. **Environment konfigurieren**
   ```bash
   cp env.example .env
   nano .env  # Alle Production-Werte eintragen
   ```

3. **Docker Netzwerk prüfen**
   ```bash
   make network
   make traefik-connect
   ```

4. **Deployment durchführen**
   ```bash
   make prod
   make migrate
   ```

5. **Logs überwachen**
   ```bash
   make logs
   # oder
   make logs-api
   make logs-web
   ```

6. **Health Checks**
   ```bash
   curl https://accounts.mojo-institut.de/api/v1/health
   curl https://accounts.mojo-institut.de/api/v1/health/detailed
   ```

## ✅ Post-Deployment

- [ ] Frontend erreichbar (`https://accounts.mojo-institut.de`)
- [ ] API Health Checks erfolgreich
- [ ] Clerk Authentication funktioniert
- [ ] Webhooks von Clerk, payments.mojo, kontakte.mojo funktionieren
- [ ] Keine kritischen Fehler in Logs
- [ ] Datenbank-Migrationen erfolgreich

## 📝 Bekannte Limitationen

- **E-Mail-Versand für Einladungen**: Noch nicht implementiert (TODO in `apps/api/src/routes/tenants.ts`)
  - Einladungs-URLs werden aktuell nur in der API-Antwort zurückgegeben
  - Manuelle Verteilung der Einladungslinks erforderlich

## 🔗 Wichtige Dokumentation

- [CHANGELOG.md](../CHANGELOG.md) - Release Notes und Änderungen
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Ausführlicher Deployment Guide
- [README.md](../README.md) - Projekt-Übersicht und Dokumentation

---

**Erstellt:** 2024-12-29  
**Version:** 0.3.0

