# Clerk Keys Setup - Lokale Entwicklung

## Wo müssen die Clerk-Keys gesetzt werden?

Die Clerk-Keys müssen in der **`.env` Datei im Projekt-Root** gesetzt werden:

```
/Users/g/MOJO/account.mojo/.env
```

## Welche Keys werden benötigt?

### 1. Backend (API) - `apps/api/`

Die API benötigt diese Keys für die Authentifizierung:

```bash
# Secret Key (für Backend-Authentifizierung)
CLERK_SECRET_KEY=sk_test_xxxx

# Publishable Key (für Backend-Validierung)
CLERK_PUBLISHABLE_KEY=pk_test_xxxx

# Webhook Secret (für Clerk Webhooks)
CLERK_WEBHOOK_SECRET=whsec_xxxx
```

**Verwendung:**
- `CLERK_SECRET_KEY`: Wird in `apps/api/src/middleware/auth.ts` verwendet, um JWT-Tokens zu validieren
- `CLERK_PUBLISHABLE_KEY`: Wird für zusätzliche Validierungen verwendet
- `CLERK_WEBHOOK_SECRET`: Wird in `apps/api/src/routes/clerk-webhooks.ts` verwendet, um Webhook-Signaturen zu verifizieren

### 2. Frontend (Next.js) - `apps/web/`

Das Frontend benötigt den Publishable Key:

```bash
# Publishable Key (für Frontend - muss mit NEXT_PUBLIC_ beginnen!)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxx
```

**Verwendung:**
- Wird automatisch von Next.js geladen (alle `NEXT_PUBLIC_*` Variablen werden im Browser verfügbar)
- Wird in `apps/web/src/app/layout.tsx` im `<ClerkProvider>` verwendet
- Next.js lädt diese Variable automatisch aus der `.env` Datei

## Wie bekomme ich die Keys?

1. Gehe zu [Clerk Dashboard](https://dashboard.clerk.com)
2. Wähle deine Application aus (oder erstelle eine neue)
3. Gehe zu **API Keys**:
   - **Publishable Key**: Beginnt mit `pk_test_...` (für Development) oder `pk_live_...` (für Production)
   - **Secret Key**: Beginnt mit `sk_test_...` (für Development) oder `sk_live_...` (für Production)
4. Für Webhooks:
   - Gehe zu **Webhooks** → Erstelle einen Endpoint
   - Kopiere das **Signing Secret** (beginnt mit `whsec_...`)

## Beispiel `.env` Datei

```bash
# Clerk Authentication
# Get from https://dashboard.clerk.com
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Clerk Webhooks
# Get from Clerk Dashboard -> Webhooks -> Your endpoint -> Signing Secret
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Wichtige Hinweise

### Development vs. Production

- **Development**: Verwende `sk_test_...` und `pk_test_...` Keys
- **Production**: Verwende `sk_live_...` und `pk_live_...` Keys

### NEXT_PUBLIC_ Prefix

- Der Frontend-Key **MUSS** mit `NEXT_PUBLIC_` beginnen!
- Next.js lädt nur Variablen mit diesem Prefix in den Browser
- Ohne `NEXT_PUBLIC_` ist der Key im Browser nicht verfügbar

### Automatisches Laden

- **Backend**: Lädt Keys aus `.env` über `dotenv` in `apps/api/src/lib/env.ts`
- **Frontend**: Next.js lädt automatisch alle `NEXT_PUBLIC_*` Variablen aus `.env`

### Nach dem Setzen

Nach dem Setzen der Keys in der `.env` Datei:

1. **Backend neu starten**:
   ```bash
   pkill -f "tsx watch.*api"
   pnpm run dev:api
   ```

2. **Frontend neu starten**:
   ```bash
   pkill -f "next dev"
   pnpm run dev:web
   ```

## Troubleshooting

### Problem: "Clerk has been loaded with development keys"

**Das ist normal!** Diese Warnung erscheint, wenn Test-Keys verwendet werden. Das ist für lokale Entwicklung korrekt.

### Problem: 401 Fehler von Clerk

**Mögliche Ursachen:**
1. Keys sind nicht in `.env` gesetzt
2. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` fehlt das `NEXT_PUBLIC_` Prefix
3. Frontend/Backend wurde nicht neu gestartet nach dem Setzen der Keys
4. Falsche Keys (z.B. Production-Keys in Development)

### Problem: Webhooks funktionieren nicht

**Prüfen:**
1. `CLERK_WEBHOOK_SECRET` ist in `.env` gesetzt
2. Webhook-Endpoint in Clerk Dashboard ist korrekt konfiguriert
3. Webhook-URL ist erreichbar (für lokale Entwicklung: ngrok oder ähnlich)

## Aktuelle Konfiguration prüfen

```bash
# Prüfe, ob Keys gesetzt sind (ohne Werte anzuzeigen)
cat .env | grep -E "CLERK" | sed 's/=.*/=***/'

# Prüfe Backend-Logs
tail -f /tmp/account-api.log | grep -i clerk

# Prüfe Frontend-Logs
tail -f /tmp/account-web.log | grep -i clerk
```

---

**Zuletzt aktualisiert:** 2026-01-04

