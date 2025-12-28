"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  CreditCard,
  ExternalLink,
  FileText,
  Download,
  Check,
  Clock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { accountsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, formatCurrency, getStatusDisplayName, getStatusColor } from "@/lib/utils";

interface Subscription {
  id: string;
  status: string;
  planId: string;
  planName: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  pdfUrl: string | null;
}

interface Entitlement {
  id: string;
  type: string;
  resourceId: string | null;
  resourceName: string | null;
  expiresAt: string | null;
}

export default function MembershipPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        if (!token) return;

        const [subRes, invRes, entRes] = await Promise.all([
          accountsApi.getSubscription(token),
          accountsApi.getInvoices(token),
          accountsApi.getEntitlements(token),
        ]);

        setSubscription(subRes.subscription);
        setInvoices(invRes.invoices);
        setEntitlements(entRes.entitlements);
      } catch (error) {
        console.error("Failed to fetch membership data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [getToken]);

  const handleOpenBillingPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const token = await getToken();
      if (!token) return;

      const { url } = await accountsApi.createBillingPortalSession(token);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Failed to open billing portal:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Billing Portal konnte nicht geöffnet werden.",
      });
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
      case "trialing":
        return <Check className="w-4 h-4 text-green-500" />;
      case "past_due":
      case "unpaid":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />

      <main className="flex-1 p-4 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Mitgliedschaft</h1>
          <p className="text-muted-foreground">
            Verwalte dein Abonnement, Rechnungen und Berechtigungen.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subscription Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Aktuelles Abonnement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscription ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{subscription.planName}</h3>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(subscription.status)}
                            <span className="text-sm text-muted-foreground">
                              {getStatusDisplayName(subscription.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button onClick={handleOpenBillingPortal} loading={isOpeningPortal}>
                        Verwalten
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-secondary/50">
                        <p className="text-sm text-muted-foreground">Aktuelle Periode</p>
                        <p className="font-medium">
                          {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/50">
                        <p className="text-sm text-muted-foreground">Nächste Verlängerung</p>
                        <p className="font-medium">
                          {subscription.cancelAtPeriodEnd ? (
                            <span className="text-yellow-500">Wird nicht verlängert</span>
                          ) : (
                            formatDate(subscription.currentPeriodEnd)
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Kein aktives Abonnement</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Starte jetzt mit einem MOJO Abonnement.
                    </p>
                    <Button onClick={handleOpenBillingPortal} loading={isOpeningPortal}>
                      Abonnement wählen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Entitlements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-card/50 h-full">
              <CardHeader>
                <CardTitle>Berechtigungen</CardTitle>
                <CardDescription>Deine aktiven Zugänge</CardDescription>
              </CardHeader>
              <CardContent>
                {entitlements.length > 0 ? (
                  <div className="space-y-3">
                    {entitlements.slice(0, 5).map((ent) => (
                      <div
                        key={ent.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                      >
                        <Check className="w-4 h-4 text-green-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {ent.resourceName || ent.type}
                          </p>
                          {ent.expiresAt && (
                            <p className="text-xs text-muted-foreground">
                              Gültig bis {formatDate(ent.expiresAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {entitlements.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{entitlements.length - 5} weitere
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine aktiven Berechtigungen
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Invoices */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3"
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Rechnungen
                </CardTitle>
                <CardDescription>
                  Übersicht deiner Zahlungen und Rechnungen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="table-header pb-3 text-left">Nummer</th>
                          <th className="table-header pb-3 text-left">Datum</th>
                          <th className="table-header pb-3 text-left">Status</th>
                          <th className="table-header pb-3 text-right">Betrag</th>
                          <th className="table-header pb-3 text-right">Aktion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          <tr key={invoice.id} className="table-row">
                            <td className="py-4">{invoice.number}</td>
                            <td className="py-4">{formatDate(invoice.createdAt)}</td>
                            <td className="py-4">
                              <span className={`badge badge-${getStatusColor(invoice.status)}`}>
                                {getStatusDisplayName(invoice.status)}
                              </span>
                            </td>
                            <td className="py-4 text-right font-medium">
                              {formatCurrency(invoice.amount, invoice.currency)}
                            </td>
                            <td className="py-4 text-right">
                              {invoice.pdfUrl && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="w-4 h-4" />
                                  </a>
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Noch keine Rechnungen vorhanden.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

