"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useIsFirstMount } from "@/hooks/useIsFirstMount";
import { useToken } from "@/hooks/useToken";
import { useApiError } from "@/hooks/useApiError";
import { accountsApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Mail,
  Send,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  created_at: string;
  last_event?: string;
}

export default function ResendAdminPage() {
  const isFirstMount = useIsFirstMount();
  const { getToken } = useToken();
  const { toast } = useToast();
  const { handleError } = useApiError();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [showSendForm, setShowSendForm] = useState(false);

  // Fetch emails
  const { data: emailsData, isLoading: isLoadingEmails, refetch: refetchEmails } = useQuery({
    queryKey: ['resend-emails'],
    queryFn: async () => {
      const token = await getToken();
      return accountsApi.getResendEmails(token, 50);
    },
    staleTime: 30 * 1000, // 30 Sekunden
  });

  // Fetch stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['resend-stats'],
    queryFn: async () => {
      const token = await getToken();
      return accountsApi.getResendStats(token);
    },
    staleTime: 60 * 1000, // 1 Minute
  });

  // Fetch domains
  const { data: domainsData, isLoading: isLoadingDomains } = useQuery({
    queryKey: ['resend-domains'],
    queryFn: async () => {
      const token = await getToken();
      return accountsApi.getResendDomains(token);
    },
    staleTime: 5 * 60 * 1000, // 5 Minuten
  });

  // Fetch selected email details
  const { data: emailDetails, isLoading: isLoadingEmailDetails } = useQuery({
    queryKey: ['resend-email', selectedEmail],
    queryFn: async () => {
      if (!selectedEmail) return null;
      const token = await getToken();
      return accountsApi.getResendEmail(token, selectedEmail);
    },
    enabled: !!selectedEmail,
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: {
      to: string | string[];
      subject: string;
      html?: string;
      text?: string;
      from?: string;
      replyTo?: string;
      tags?: string[];
    }) => {
      const token = await getToken();
      return accountsApi.sendResendEmail(token, data);
    },
    onSuccess: () => {
      toast({
        title: "E-Mail gesendet",
        description: "Die E-Mail wurde erfolgreich versendet.",
      });
      setShowSendForm(false);
      queryClient.invalidateQueries({ queryKey: ['resend-emails'] });
      queryClient.invalidateQueries({ queryKey: ['resend-stats'] });
    },
    onError: (error) => {
      handleError(error, "E-Mail konnte nicht gesendet werden.");
    },
  });

  // Filter emails by search query
  const filteredEmails = emailsData?.emails?.filter((email) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(query) ||
      email.from.toLowerCase().includes(query) ||
      email.to.some((to) => to.toLowerCase().includes(query))
    );
  }) || [];

  // Get event icon
  const getEventIcon = (event?: string) => {
    switch (event) {
      case 'delivered':
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'bounced':
      case 'complained':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'opened':
      case 'clicked':
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <motion.div
        initial={isFirstMount ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Mail className="w-8 h-8 text-primary" />
              E-Mail Verwaltung
            </h1>
            <p className="text-muted-foreground">
              Verwalte E-Mails über Resend - Nur für Platform Admins
            </p>
          </div>
          <Button onClick={() => setShowSendForm(!showSendForm)}>
            <Send className="w-4 h-4 mr-2" />
            E-Mail senden
          </Button>
        </div>
      </motion.div>

      <div className="space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div
              initial={isFirstMount ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={isFirstMount ? { delay: 0.1 } : {}}
            >
              <Card className="bg-card/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Gesamt</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={isFirstMount ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={isFirstMount ? { delay: 0.2 } : {}}
            >
              <Card className="bg-card/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Zugestellt</p>
                      <p className="text-2xl font-bold text-green-500">{stats.delivered}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={isFirstMount ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={isFirstMount ? { delay: 0.3 } : {}}
            >
              <Card className="bg-card/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Geöffnet</p>
                      <p className="text-2xl font-bold text-blue-500">{stats.opened}</p>
                    </div>
                    <Eye className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={isFirstMount ? { opacity: 0, y: 20 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={isFirstMount ? { delay: 0.4 } : {}}
            >
              <Card className="bg-card/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Bounced</p>
                      <p className="text-2xl font-bold text-red-500">{stats.bounced}</p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Send Email Form */}
        {showSendForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>E-Mail senden</CardTitle>
                <CardDescription>
                  Sende eine E-Mail direkt über Resend (ohne Präferenzen-Check)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SendEmailForm
                  onSubmit={(data) => sendEmailMutation.mutate(data)}
                  isLoading={sendEmailMutation.isPending}
                  onCancel={() => setShowSendForm(false)}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Domains */}
        {domainsData && (
          <motion.div
            initial={isFirstMount ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={isFirstMount ? { delay: 0.5 } : {}}
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle>Verifizierte Domains</CardTitle>
                <CardDescription>
                  Domains, die für E-Mail-Versendung konfiguriert sind
                </CardDescription>
              </CardHeader>
              <CardContent>
                {domainsData.domains.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Domains konfiguriert</p>
                ) : (
                  <div className="space-y-2">
                    {domainsData.domains.map((domain) => (
                      <div
                        key={domain.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50"
                      >
                        <div>
                          <p className="font-medium">{domain.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Status: {domain.status} • Erstellt: {formatDate(domain.created_at)}
                          </p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          domain.status === 'verified' 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {domain.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Email List */}
        <motion.div
          initial={isFirstMount ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={isFirstMount ? { delay: 0.6 } : {}}
        >
          <Card className="bg-card/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gesendete E-Mails</CardTitle>
                  <CardDescription>
                    Liste aller über Resend versendeten E-Mails
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchEmails()}
                  disabled={isLoadingEmails}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingEmails ? 'animate-spin' : ''}`} />
                  Aktualisieren
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="E-Mails durchsuchen (Betreff, Absender, Empfänger)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Email List */}
              {isLoadingEmails ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "Keine E-Mails gefunden" : "Noch keine E-Mails gesendet"}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEmails.map((email) => (
                    <div
                      key={email.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedEmail === email.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-secondary/50 hover:bg-secondary'
                      }`}
                      onClick={() => setSelectedEmail(selectedEmail === email.id ? null : email.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getEventIcon(email.last_event)}
                            <p className="font-medium truncate">{email.subject}</p>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Von: {email.from}
                            </p>
                            <p>An: {email.to.join(", ")}</p>
                            <p className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(email.created_at)}
                            </p>
                          </div>
                        </div>
                        {email.last_event && (
                          <div className="shrink-0">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              email.last_event === 'delivered' || email.last_event === 'sent'
                                ? 'bg-green-500/10 text-green-500'
                                : email.last_event === 'bounced' || email.last_event === 'complained'
                                ? 'bg-red-500/10 text-red-500'
                                : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {email.last_event}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Email Details */}
        {selectedEmail && emailDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>E-Mail Details</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedEmail(null)}
                  >
                    Schließen
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingEmailDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label>Betreff</Label>
                      <p className="font-medium">{emailDetails.subject}</p>
                    </div>
                    <div>
                      <Label>Von</Label>
                      <p>{emailDetails.from}</p>
                    </div>
                    <div>
                      <Label>An</Label>
                      <p>{emailDetails.to.join(", ")}</p>
                    </div>
                    <div>
                      <Label>Gesendet am</Label>
                      <p>{formatDate(emailDetails.created_at)}</p>
                    </div>
                    {emailDetails.last_event && (
                      <div>
                        <Label>Status</Label>
                        <p>{emailDetails.last_event}</p>
                      </div>
                    )}
                    {emailDetails.html && (
                      <div>
                        <Label>HTML Inhalt</Label>
                        <div className="mt-2 p-4 rounded-lg border border-border bg-secondary/50 max-h-96 overflow-auto">
                          <div dangerouslySetInnerHTML={{ __html: emailDetails.html }} />
                        </div>
                      </div>
                    )}
                    {emailDetails.text && (
                      <div>
                        <Label>Text Inhalt</Label>
                        <div className="mt-2 p-4 rounded-lg border border-border bg-secondary/50 max-h-96 overflow-auto whitespace-pre-wrap">
                          {emailDetails.text}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </>
  );
}

// Send Email Form Component
function SendEmailForm({
  onSubmit,
  isLoading,
  onCancel,
}: {
  onSubmit: (data: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
    tags?: string[];
  }) => void;
  isLoading: boolean;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    to: "",
    subject: "",
    html: "",
    text: "",
    from: "",
    replyTo: "",
    tags: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      to: formData.to.split(",").map((email) => email.trim()).filter(Boolean),
      subject: formData.subject,
      html: formData.html || undefined,
      text: formData.text || undefined,
      from: formData.from || undefined,
      replyTo: formData.replyTo || undefined,
      tags: formData.tags ? formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="to">An (E-Mail-Adressen, kommagetrennt)</Label>
        <Input
          id="to"
          type="email"
          value={formData.to}
          onChange={(e) => setFormData({ ...formData, to: e.target.value })}
          placeholder="user@example.com, user2@example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Betreff</Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="E-Mail Betreff"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="from">Von (optional)</Label>
        <Input
          id="from"
          value={formData.from}
          onChange={(e) => setFormData({ ...formData, from: e.target.value })}
          placeholder="MOJO Institut <noreply@mojo-institut.de>"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="html">HTML Inhalt</Label>
        <textarea
          id="html"
          value={formData.html}
          onChange={(e) => setFormData({ ...formData, html: e.target.value })}
          placeholder="<html>...</html>"
          className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          rows={10}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="text">Text Inhalt (optional, falls kein HTML)</Label>
        <textarea
          id="text"
          value={formData.text}
          onChange={(e) => setFormData({ ...formData, text: e.target.value })}
          placeholder="Text-Inhalt der E-Mail"
          className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          rows={6}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="replyTo">Reply-To (optional)</Label>
          <Input
            id="replyTo"
            type="email"
            value={formData.replyTo}
            onChange={(e) => setFormData({ ...formData, replyTo: e.target.value })}
            placeholder="support@mojo-institut.de"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (optional, kommagetrennt)</Label>
          <Input
            id="tags"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="admin, test, notification"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Senden...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              E-Mail senden
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

