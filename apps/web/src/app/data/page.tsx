"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  Database,
  Download,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { accountsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime, getStatusDisplayName } from "@/lib/utils";

interface DataRequest {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
}

export default function DataPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  useEffect(() => {
    async function fetchRequests() {
      try {
        const token = await getToken();
        if (!token) return;

        const data = await accountsApi.getDataRequests(token);
        setRequests(data.requests);
      } catch (error) {
        console.error("Failed to fetch data requests:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRequests();
  }, [getToken]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const result = await accountsApi.requestDataExport(token);

      toast({
        title: "Export angefordert",
        description: result.message,
      });

      // Refresh requests
      const data = await accountsApi.getDataRequests(token);
      setRequests(data.requests);
    } catch (error) {
      console.error("Failed to request export:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Export konnte nicht angefordert werden.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const result = await accountsApi.requestDataDeletion(token, deleteReason);

      toast({
        title: "Löschung angefordert",
        description: result.message,
      });

      setShowDeleteConfirm(false);
      setDeleteReason("");

      // Refresh requests
      const data = await accountsApi.getDataRequests(token);
      setRequests(data.requests);
    } catch (error) {
      console.error("Failed to request deletion:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Löschung konnte nicht angefordert werden.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      await accountsApi.cancelDataRequest(token, requestId);

      toast({
        title: "Anfrage abgebrochen",
        description: "Die Anfrage wurde abgebrochen.",
      });

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (error) {
      console.error("Failed to cancel request:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Anfrage konnte nicht abgebrochen werden.",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-destructive" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
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
          <h1 className="text-3xl font-bold mb-2">Daten & Privatsphäre</h1>
          <p className="text-muted-foreground">
            Verwalte deine persönlichen Daten gemäß DSGVO.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Export Data */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Daten exportieren
                </CardTitle>
                <CardDescription>
                  Fordere eine Kopie aller deiner gespeicherten Daten an.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Der Export enthält alle deine Profildaten, Einstellungen und Aktivitäten.
                  Du wirst per E-Mail benachrichtigt, sobald der Export bereit ist.
                </p>
                <Button onClick={handleExport} loading={isExporting}>
                  <Download className="w-4 h-4 mr-2" />
                  Daten exportieren
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Delete Account */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-card/50 border-destructive/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" />
                  Konto löschen
                </CardTitle>
                <CardDescription>
                  Lösche dein Konto und alle zugehörigen Daten dauerhaft.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!showDeleteConfirm ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      <strong className="text-destructive">Achtung:</strong> Diese Aktion kann nicht
                      rückgängig gemacht werden. Alle deine Daten werden dauerhaft gelöscht.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Löschung anfordern
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-destructive">
                            Bist du sicher?
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Dein Konto wird innerhalb von 30 Tagen gelöscht. Du kannst die
                            Löschung bis dahin abbrechen.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="text-sm font-medium">
                        Grund (optional)
                      </label>
                      <textarea
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        className="form-input min-h-[80px] resize-none"
                        placeholder="Hilf uns, unseren Service zu verbessern..."
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDelete}
                        loading={isDeleting}
                      >
                        Konto löschen
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Request History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Anfragen-Verlauf
                </CardTitle>
                <CardDescription>
                  Übersicht deiner Daten-Anfragen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {requests.length > 0 ? (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-center gap-4">
                          {getStatusIcon(request.status)}
                          <div>
                            <p className="font-medium">
                              {request.type === "export" ? "Daten-Export" : "Konto-Löschung"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(request.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`badge badge-${request.status === "completed" ? "success" : request.status === "failed" ? "destructive" : "warning"}`}>
                            {getStatusDisplayName(request.status)}
                          </span>
                          {request.status === "completed" && request.downloadUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={request.downloadUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                          {request.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelRequest(request.id)}
                            >
                              Abbrechen
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Keine Anfragen vorhanden.
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


