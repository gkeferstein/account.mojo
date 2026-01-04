"use client";

import { useState, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useToken } from "@/hooks/useToken";
import { useApiError } from "@/hooks/useApiError";
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

function DataPageContent() {
  const { getToken } = useToken();
  const { toast } = useToast();
  const { handleError } = useApiError();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  // Fetch data requests with React Query
  const { data, isLoading } = useQuery({
    queryKey: ['data-requests'],
    queryFn: async () => {
      const token = await getToken();
      return accountsApi.getDataRequests(token);
    },
    staleTime: 2 * 60 * 1000, // 2 Minuten
  });

  const requests = data?.requests || [];

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return accountsApi.requestDataExport(token);
    },
    onSuccess: (result) => {
      toast({
        title: "Export angefordert",
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ['data-requests'] });
    },
    onError: (error) => {
      handleError(error, "Export konnte nicht angefordert werden.");
    },
  });

  const isExporting = exportMutation.isPending;

  const handleExport = () => {
    exportMutation.mutate();
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      const token = await getToken();
      return accountsApi.requestDataDeletion(token, reason);
    },
    onSuccess: (result) => {
      toast({
        title: "Löschung angefordert",
        description: result.message,
      });
      setShowDeleteConfirm(false);
      setDeleteReason("");
      queryClient.invalidateQueries({ queryKey: ['data-requests'] });
    },
    onError: (error) => {
      handleError(error, "Löschung konnte nicht angefordert werden.");
    },
  });

  const isDeleting = deleteMutation.isPending;

  const handleDelete = () => {
    deleteMutation.mutate(deleteReason);
  };

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const token = await getToken();
      return accountsApi.cancelDataRequest(token, requestId);
    },
    onSuccess: () => {
      toast({
        title: "Anfrage abgebrochen",
        description: "Die Anfrage wurde abgebrochen.",
      });
      queryClient.invalidateQueries({ queryKey: ['data-requests'] });
    },
    onError: (error) => {
      handleError(error, "Anfrage konnte nicht abgebrochen werden.");
    },
  });

  const handleCancelRequest = (requestId: string) => {
    cancelMutation.mutate(requestId);
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
    <>
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
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird angefordert...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Daten exportieren
                  </>
                )}
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
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Wird gelöscht...
                        </>
                      ) : (
                        "Konto löschen"
                      )}
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
    </>
  );
}

// Loading skeleton component
function DataPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function DataPage() {
  return (
    <Suspense fallback={<DataPageSkeleton />}>
      <DataPageContent />
    </Suspense>
  );
}
