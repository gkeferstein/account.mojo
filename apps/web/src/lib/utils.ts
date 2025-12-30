import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function formatDate(date: Date | string, locale: string = "de-DE"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string, locale: string = "de-DE"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Minute${diffMin !== 1 ? "n" : ""}`;
  if (diffHour < 24) return `vor ${diffHour} Stunde${diffHour !== 1 ? "n" : ""}`;
  if (diffDay < 7) return `vor ${diffDay} Tag${diffDay !== 1 ? "en" : ""}`;
  
  return formatDate(d);
}

export function getInitials(firstName?: string | null, lastName?: string | null, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "??";
}

export function getRoleDisplayName(role: string): string {
  const roles: Record<string, string> = {
    owner: "Inhaber",
    admin: "Administrator",
    member: "Mitglied",
    billing_admin: "Billing Admin",
    support_readonly: "Support (Nur Lesen)",
  };
  return roles[role] || role;
}

export function getStatusDisplayName(status: string): string {
  const statuses: Record<string, string> = {
    active: "Aktiv",
    trialing: "Testphase",
    past_due: "Überfällig",
    canceled: "Gekündigt",
    unpaid: "Unbezahlt",
    incomplete: "Unvollständig",
    pending: "Ausstehend",
    processing: "In Bearbeitung",
    completed: "Abgeschlossen",
    failed: "Fehlgeschlagen",
  };
  return statuses[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "success",
    trialing: "warning",
    past_due: "destructive",
    canceled: "muted",
    unpaid: "destructive",
    pending: "warning",
    processing: "primary",
    completed: "success",
    failed: "destructive",
  };
  return colors[status] || "muted";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + "...";
}







