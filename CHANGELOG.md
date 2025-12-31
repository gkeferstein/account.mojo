# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt adhäriert zu [Semantic Versioning](https://semver.org/lang/de/).

## [0.3.0] - 2024-12-29

### Added
- **Multi-Tenant Account Management System** - Vollständiges Account-Management-Portal für MOJO-Kunden
- **Profilverwaltung** - Persönliche Daten, Rechnungskontakt und Adressverwaltung
- **Multi-Tenancy** - Teams/Organisationen mit Rollenverwaltung (owner, admin, member, billing_admin, support_readonly)
- **Abonnement-Management** - Integration mit payments.mojo für Subscription-Status, Rechnungen und Stripe Billing Portal
- **Berechtigungen** - Entitlements-System für Kurse, Features und Ressourcen
- **Team-Management** - Mitglieder einladen, Rollen verwalten, Einladungen widerrufen
- **MOJO Journey** - Graduierungssystem mit 6 Stufen (Lebensenergie, Campus, Business Bootcamp, RegenerationsmedizinOS, Praxiszirkel, MOJO Inkubator)
- **DSGVO-Compliance** - Datenexport und Account-Löschung über Data Request System
- **Clerk Integration** - Vollständige Authentifizierung mit JWT und Webhook-Synchronisation
- **Webhook-System** - Integration mit payments.mojo, kontakte.mojo und Clerk für Echtzeit-Synchronisation
- **Internal API** - Service-to-Service API für andere MOJO-Services
- **Audit Logging** - Vollständiger Audit-Trail für alle wichtigen Aktionen
- **Health Checks** - Health, Readiness und Liveness Endpoints für Kubernetes/Container-Monitoring
- **Caching-System** - Profile-, Billing- und Entitlement-Cache für optimale Performance
- **RBAC Middleware** - Granulare Rollenbasierte Zugriffskontrolle
- **Personal Organization Provisioning** - Automatische Erstellung von Personal Tenants bei User-Registrierung
- **MOJO Design System Integration** - Verwendung von @mojo/design für konsistentes UI
- **Next.js 14 Frontend** - Moderne React-basierte Benutzeroberfläche
- **Fastify Backend** - Hochperformante API mit TypeScript
- **Prisma ORM** - Type-safe Datenbankzugriff mit PostgreSQL
- **Docker Setup** - Vollständige Containerisierung für Development und Production

### Technical Details
- **Stack**: Next.js 15, Fastify 5, Prisma 6, PostgreSQL 16
- **Authentication**: Clerk (JWT + Webhooks)
- **External Services**: payments.mojo (Billing), kontakte.mojo (CRM/SSOT)
- **Deployment**: Docker Compose mit Traefik Reverse Proxy
- **Database**: PostgreSQL mit automatischen Migrationen

### Known Limitations
- E-Mail-Versand für Team-Einladungen noch nicht implementiert (TODO in `apps/api/src/routes/tenants.ts`)
  - Einladungs-URLs werden aktuell nur in der API-Antwort zurückgegeben
  - Manuelle Verteilung der Einladungslinks erforderlich

### Infrastructure
- Production Domain: `account.mojo-institut.de`
- Development Domain: `dev.account.mojo-institut.de`
- Docker Network: `mojo-network` (shared mit anderen MOJO Services)
- Health Endpoints: `/api/v1/health`, `/api/v1/health/detailed`, `/api/v1/ready`, `/api/v1/live`

---

## Release Checklist

Für zukünftige Releases:

- [ ] Version in allen `package.json` Dateien aktualisieren
- [ ] CHANGELOG.md aktualisieren
- [ ] README.md auf Aktualität prüfen
- [ ] Tests ausführen (`make test`)
- [ ] Build testen (`make build`)
- [ ] Linting prüfen (`npm run lint`)
- [ ] Docker Images bauen und testen
- [ ] Production Environment Variablen validieren
- [ ] Migrationen testen (`make migrate-dev`)
- [ ] Git Tag erstellen (`git tag v0.3.0`)
- [ ] Release Notes für Stakeholder vorbereiten

