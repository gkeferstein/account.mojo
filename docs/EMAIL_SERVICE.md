# Email Service - Zentrale E-Mail-Versendung für MOJO Apps

## Überblick

**accounts.mojo** ist der zentrale E-Mail-Service für alle MOJO Apps. Alle E-Mails werden über Resend versendet und respektieren automatisch die Benutzer-Präferenzen.

## Warum zentral?

✅ **Einheitliches Branding** - Alle E-Mails haben konsistentes Design  
✅ **Präferenzen-Integration** - Automatische Einhaltung der Benutzer-Einstellungen  
✅ **Einfacheres Management** - Ein API-Key, zentrale Logs  
✅ **Bessere Zustellbarkeit** - Zentrale Reputation  
✅ **Kostenoptimierung** - Ein Resend-Account statt mehrerer  

## Architektur

```
┌─────────────────┐
│ payments.mojo   │
│ kontakte.mojo   │─────┐
│ andere Apps     │     │
└─────────────────┘     │
                        ▼
              ┌──────────────────┐
              │  accounts.mojo   │
              │  Email Service   │
              │  (Resend)        │
              └──────────────────┘
                        │
                        ▼
                   ┌─────────┐
                   │ Resend  │
                   └─────────┘
```

## Verwendung

### In account.mojo (direkt)

```typescript
import { sendEmail, sendTenantInvitationEmail } from '../services/email.service.js';

// Tenant-Einladung senden
await sendTenantInvitationEmail({
  to: 'user@example.com',
  tenantName: 'Mein Team',
  inviterName: 'Max Mustermann',
  role: 'admin',
  inviteUrl: 'https://account.mojo-institut.de/invite?token=xxx',
  expiresAt: new Date('2024-12-31'),
});

// Generische E-Mail mit Präferenzen-Check
await sendEmail({
  to: 'user@example.com',
  subject: 'Newsletter Januar 2024',
  template: 'newsletter',
  data: {
    title: 'Newsletter Januar 2024',
    content: '...',
  },
  checkPreferences: {
    clerkUserId: 'user_xxx',
    tenantId: 'tenant_xxx',
    preferenceType: 'newsletter', // Wird nur gesendet wenn newsletter=true
  },
});
```

### Von anderen Services (Internal API)

```bash
POST https://account.mojo-institut.de/api/internal/email/send
Headers:
  X-Internal-Token: <INTERNAL_API_SECRET>
  Content-Type: application/json
Body:
{
  "to": "user@example.com",
  "subject": "Rechnung #INV-123",
  "template": "invoice",
  "data": {
    "invoiceNumber": "INV-123",
    "customerName": "Max Mustermann",
    "amount": "99,00",
    "currency": "EUR",
    "dueDate": "2024-12-31",
    "invoiceUrl": "https://account.mojo-institut.de/invoices/123"
  },
  "checkPreferences": {
    "clerkUserId": "user_xxx",
    "tenantId": "tenant_xxx",
    "preferenceType": "emailNotifications"
  },
  "tags": ["invoice", "billing"],
  "metadata": {
    "invoice_id": "123",
    "tenant_id": "tenant_xxx"
  }
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "re_xxxx",
  "skipped": false  // true wenn wegen Präferenzen übersprungen
}
```

## Verfügbare Templates

| Template | Beschreibung | Präferenz-Typ |
|----------|-------------|---------------|
| `tenant-invitation` | Team-Einladungen | `emailNotifications` |
| `invoice` | Rechnungen | `emailNotifications` (immer senden) |
| `subscription-update` | Abo-Updates | `emailNotifications` |
| `newsletter` | Newsletter | `newsletter` |
| `marketing` | Marketing-E-Mails | `marketingEmails` |
| `product-update` | Produkt-Updates | `productUpdates` |
| `security-alert` | Sicherheitsbenachrichtigungen | `emailNotifications` (immer senden) |
| `welcome` | Willkommens-E-Mails | `emailNotifications` |
| `password-reset` | Passwort-Reset | `emailNotifications` (immer senden) |
| `account-deleted` | Account-Löschung | `emailNotifications` (immer senden) |

## Präferenzen-Typen

| Typ | Beschreibung | Standard |
|-----|-------------|----------|
| `newsletter` | Newsletter & Updates | Opt-in (false) |
| `marketingEmails` | Marketing & Angebote | Opt-in (false) |
| `productUpdates` | Produkt-Updates | Opt-in (true) |
| `emailNotifications` | Wichtige Account-Benachrichtigungen | Opt-out (true) |

**Wichtige E-Mails** (Rechnungen, Sicherheit, etc.) werden **immer** gesendet, unabhängig von Präferenzen.

## Konfiguration

### Environment-Variablen

```bash
# Resend API Key (erforderlich)
RESEND_API_KEY=re_xxxx  # Von https://resend.com/api-keys

# Absender-Adresse
EMAIL_FROM=MOJO Institut <noreply@mojo-institut.de>

# Internal API Secret (für andere Services)
INTERNAL_API_SECRET=<openssl rand -hex 32>
```

### Resend Setup

1. Account erstellen: https://resend.com
2. API Key generieren: https://resend.com/api-keys
3. Domain verifizieren (für Production)
4. API Key in `.env` eintragen

## Migration von payments.mojo

Wenn du Resend aus payments.mojo entfernen möchtest:

1. **Resend aus payments.mojo entfernen:**
   ```bash
   cd payments.mojo
   npm uninstall resend
   ```

2. **E-Mail-Versendung auf Internal API umstellen:**
   ```typescript
   // Vorher (direkt in payments.mojo):
   import { Resend } from 'resend';
   const resend = new Resend(process.env.RESEND_API_KEY);
   await resend.emails.send({ ... });

   // Nachher (über accounts.mojo):
   await fetch('https://account.mojo-institut.de/api/internal/email/send', {
     method: 'POST',
     headers: {
       'X-Internal-Token': process.env.ACCOUNTS_INTERNAL_API_SECRET,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       to: 'user@example.com',
       subject: 'Rechnung #123',
       template: 'invoice',
       data: { ... },
       checkPreferences: {
         clerkUserId: 'user_xxx',
         tenantId: 'tenant_xxx',
         preferenceType: 'emailNotifications',
       },
     }),
   });
   ```

3. **Environment-Variablen in payments.mojo:**
   ```bash
   # Entfernen:
   # RESEND_API_KEY=re_xxxx

   # Hinzufügen:
   ACCOUNTS_API_URL=https://account.mojo-institut.de
   ACCOUNTS_INTERNAL_API_SECRET=<INTERNAL_API_SECRET aus accounts.mojo>
   ```

## Template-Entwicklung

Aktuell werden einfache HTML-Templates verwendet. Für die Zukunft sind React Email Templates geplant:

```typescript
// TODO: React Email Templates
import { render } from 'react-email';
import { TenantInvitationEmail } from './templates/TenantInvitationEmail';

const html = await render(<TenantInvitationEmail data={data} />);
```

## Monitoring & Logging

Alle E-Mail-Versendungen werden geloggt:

```typescript
appLogger.info('Email sent successfully', {
  to: options.to,
  subject: options.subject,
  template: options.template,
  messageId: result.data?.id,
});
```

**Logs enthalten:**
- Empfänger
- Betreff
- Template
- Resend Message ID
- Präferenzen-Status (gesendet/übersprungen)

## Fehlerbehandlung

- **Resend nicht konfiguriert:** E-Mail wird nicht gesendet, Warnung im Log
- **Präferenzen-Check fehlgeschlagen:** E-Mail wird gesendet (fail-open für wichtige E-Mails)
- **Resend API Fehler:** Fehler wird geloggt, Response enthält Fehlermeldung

## Best Practices

1. **Immer Präferenzen prüfen** für Marketing/Newsletter E-Mails
2. **Wichtige E-Mails** (Rechnungen, Sicherheit) immer senden
3. **Tags verwenden** für besseres Monitoring (`invoice`, `billing`, `marketing`)
4. **Metadata hinzufügen** für Tracking (`invoice_id`, `tenant_id`)
5. **Reply-To setzen** für Support-E-Mails

## Support

Bei Fragen oder Problemen:
- Dokumentation: Siehe `apps/api/src/services/email.service.ts`
- Logs: `make logs-api`
- Resend Dashboard: https://resend.com/emails

