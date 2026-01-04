# Email Service - Zentrale E-Mail-Versendung für MOJO Ökosystem

> **Diese Dokumentation sollte in `platform.mojo/docs/EMAIL_SERVICE.md` eingefügt werden.**

## Überblick

**accounts.mojo** ist der zentrale E-Mail-Service für das gesamte MOJO Ökosystem. Alle E-Mails werden über Resend versendet und respektieren automatisch die Benutzer-Präferenzen.

## Architektur-Entscheidung

### Warum zentral bei accounts.mojo?

✅ **Einheitliches Branding** - Alle E-Mails haben konsistentes Design  
✅ **Präferenzen-Integration** - Automatische Einhaltung der Benutzer-Einstellungen  
✅ **Einfacheres Management** - Ein API-Key, zentrale Logs  
✅ **Bessere Zustellbarkeit** - Zentrale Reputation  
✅ **Kostenoptimierung** - Ein Resend-Account statt mehrerer  
✅ **Konsistente UX** - Benutzer verwalten E-Mail-Präferenzen in account.mojo  

### Service-Architektur

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

## Integration

### Für payments.mojo

**Vorher (direkt mit Resend):**
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({ ... });
```

**Nachher (über accounts.mojo):**
```typescript
// Rechnungs-E-Mail senden
const response = await fetch('https://account.mojo-institut.de/api/internal/email/send', {
  method: 'POST',
  headers: {
    'X-Internal-Token': process.env.ACCOUNTS_INTERNAL_API_SECRET,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: customerEmail,
    subject: `Rechnung #${invoiceNumber}`,
    template: 'invoice',
    data: {
      invoiceNumber,
      customerName,
      amount,
      currency,
      dueDate: dueDate.toISOString(),
      invoiceUrl: `https://account.mojo-institut.de/invoices/${invoiceId}`,
    },
    checkPreferences: {
      clerkUserId: customer.clerkUserId,
      tenantId: customer.tenantId,
      preferenceType: 'emailNotifications', // Rechnungen immer senden
    },
    tags: ['invoice', 'billing'],
    metadata: {
      invoice_id: invoiceId,
      tenant_id: customer.tenantId,
    },
  }),
});
```

**Environment-Variablen in payments.mojo:**
```bash
# Entfernen:
# RESEND_API_KEY=re_xxxx

# Hinzufügen:
ACCOUNTS_API_URL=https://account.mojo-institut.de
ACCOUNTS_INTERNAL_API_SECRET=<INTERNAL_API_SECRET aus accounts.mojo>
```

### Für kontakte.mojo

```typescript
// Newsletter senden
const response = await fetch('https://account.mojo-institut.de/api/internal/email/send', {
  method: 'POST',
  headers: {
    'X-Internal-Token': process.env.ACCOUNTS_INTERNAL_API_SECRET,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: customerEmail,
    subject: 'Newsletter Januar 2024',
    template: 'newsletter',
    data: {
      title: 'Newsletter Januar 2024',
      content: newsletterContent,
    },
    checkPreferences: {
      clerkUserId: customer.clerkUserId,
      tenantId: customer.tenantId,
      preferenceType: 'newsletter', // Wird nur gesendet wenn newsletter=true
    },
    tags: ['newsletter', 'marketing'],
  }),
});
```

## API-Referenz

### Endpoint

```
POST /api/internal/email/send
```

### Authentication

```
X-Internal-Token: <INTERNAL_API_SECRET>
```

### Request Body

```typescript
{
  to: string | string[];                    // Empfänger
  subject: string;                           // Betreff
  template: EmailTemplate;                   // Template-Name
  data: Record<string, any>;                // Template-Daten
  from?: string;                            // Absender (optional)
  replyTo?: string;                         // Reply-To (optional)
  tags?: string[];                          // Tags für Monitoring
  metadata?: Record<string, string>;       // Metadata für Tracking
  checkPreferences?: {                      // Präferenzen-Check (optional)
    clerkUserId: string;
    tenantId: string;
    preferenceType: 'newsletter' | 'marketingEmails' | 'productUpdates' | 'emailNotifications';
  };
}
```

### Response

```typescript
{
  success: boolean;
  messageId?: string;      // Resend Message ID
  skipped?: boolean;       // true wenn wegen Präferenzen übersprungen
  error?: string;          // Fehlermeldung (bei Fehler)
}
```

## Verfügbare Templates

| Template | Beschreibung | Präferenz-Typ | Immer senden? |
|----------|-------------|---------------|---------------|
| `tenant-invitation` | Team-Einladungen | `emailNotifications` | Nein |
| `invoice` | Rechnungen | `emailNotifications` | Ja |
| `subscription-update` | Abo-Updates | `emailNotifications` | Nein |
| `newsletter` | Newsletter | `newsletter` | Nein |
| `marketing` | Marketing-E-Mails | `marketingEmails` | Nein |
| `product-update` | Produkt-Updates | `productUpdates` | Nein |
| `security-alert` | Sicherheitsbenachrichtigungen | `emailNotifications` | Ja |
| `welcome` | Willkommens-E-Mails | `emailNotifications` | Nein |
| `password-reset` | Passwort-Reset | `emailNotifications` | Ja |
| `account-deleted` | Account-Löschung | `emailNotifications` | Ja |

## Präferenzen-Typen

| Typ | Beschreibung | Standard | Opt-in/Opt-out |
|-----|-------------|----------|----------------|
| `newsletter` | Newsletter & Updates | `false` | Opt-in |
| `marketingEmails` | Marketing & Angebote | `false` | Opt-in |
| `productUpdates` | Produkt-Updates | `true` | Opt-in |
| `emailNotifications` | Wichtige Account-Benachrichtigungen | `true` | Opt-out |

**Wichtige E-Mails** (Rechnungen, Sicherheit, Passwort-Reset) werden **immer** gesendet, unabhängig von Präferenzen.

## Migration Guide

### Schritt 1: Resend aus payments.mojo entfernen

```bash
cd payments.mojo
npm uninstall resend
# Oder
pnpm remove resend
```

### Schritt 2: E-Mail-Code umstellen

**Vorher:**
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'MOJO Institut <noreply@mojo-institut.de>',
  to: email,
  subject: 'Rechnung #123',
  html: invoiceHtml,
  text: invoiceText,
});
```

**Nachher:**
```typescript
const response = await fetch(`${process.env.ACCOUNTS_API_URL}/api/internal/email/send`, {
  method: 'POST',
  headers: {
    'X-Internal-Token': process.env.ACCOUNTS_INTERNAL_API_SECRET,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: email,
    subject: 'Rechnung #123',
    template: 'invoice',
    data: {
      invoiceNumber: '123',
      customerName: customer.name,
      amount: '99,00',
      currency: 'EUR',
      dueDate: dueDate.toISOString(),
      invoiceUrl: invoiceUrl,
    },
    checkPreferences: {
      clerkUserId: customer.clerkUserId,
      tenantId: customer.tenantId,
      preferenceType: 'emailNotifications',
    },
  }),
});

const result = await response.json();
if (!result.success) {
  throw new Error(result.error || 'Failed to send email');
}
```

### Schritt 3: Environment-Variablen aktualisieren

**Entfernen:**
```bash
RESEND_API_KEY=re_xxxx
```

**Hinzufügen:**
```bash
ACCOUNTS_API_URL=https://account.mojo-institut.de
ACCOUNTS_INTERNAL_API_SECRET=<INTERNAL_API_SECRET aus accounts.mojo>
```

### Schritt 4: Tests durchführen

1. Test-E-Mail senden
2. Präferenzen-Check testen (Newsletter deaktivieren → E-Mail sollte übersprungen werden)
3. Logs prüfen (`make logs-api` in accounts.mojo)

## Best Practices

1. **Immer Präferenzen prüfen** für Marketing/Newsletter E-Mails
2. **Wichtige E-Mails** (Rechnungen, Sicherheit) immer senden
3. **Tags verwenden** für besseres Monitoring (`invoice`, `billing`, `marketing`)
4. **Metadata hinzufügen** für Tracking (`invoice_id`, `tenant_id`)
5. **Reply-To setzen** für Support-E-Mails
6. **Fehlerbehandlung** - E-Mail-Fehler sollten nicht die Hauptfunktion blockieren

## Monitoring

Alle E-Mail-Versendungen werden in accounts.mojo geloggt:

```bash
# Logs anzeigen
cd accounts.mojo
make logs-api | grep "Email"
```

**Log-Einträge enthalten:**
- Empfänger
- Betreff
- Template
- Resend Message ID
- Präferenzen-Status (gesendet/übersprungen)

## Fehlerbehandlung

- **Resend nicht konfiguriert:** E-Mail wird nicht gesendet, Warnung im Log
- **Präferenzen-Check fehlgeschlagen:** E-Mail wird gesendet (fail-open für wichtige E-Mails)
- **Resend API Fehler:** Fehler wird geloggt, Response enthält Fehlermeldung
- **Internal API Fehler:** Retry-Logik implementieren, Fallback auf Logging

## Support & Dokumentation

- **Detaillierte Dokumentation:** `accounts.mojo/docs/EMAIL_SERVICE.md`
- **Service-Implementierung:** `accounts.mojo/apps/api/src/services/email.service.ts`
- **API-Endpoint:** `accounts.mojo/apps/api/src/routes/internal.ts`
- **Resend Dashboard:** https://resend.com/emails

## Changelog

- **2024-12-29:** Zentrale E-Mail-Service in accounts.mojo implementiert
- **Migration:** Resend aus payments.mojo entfernt, auf Internal API umgestellt

