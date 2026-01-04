"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Download, Calendar, DollarSign, FileText } from "lucide-react";
import { useToken } from "@/hooks/useToken";
import { useApiError } from "@/hooks/useApiError";
import { accountsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
interface Statement {
  id: string;
  period: string;
  totalRevenue: number;
  currency: string;
  transactions: number;
  createdAt: string;
  pdfUrl: string | null;
}

export default function RevenuePage() {
  const { getToken } = useToken();
  const { handleError } = useApiError();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStatements() {
      try {
        const token = await getToken();
        const data = await accountsApi.getStatements(token);
        setStatements(data.statements);
      } catch (error) {
        handleError(error, "Einnahmen konnten nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchStatements();
  }, [getToken]);

  const formatCurrency = (amount: number, currency: string = "EUR") => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
    }).format(amount / 100); // Assuming amounts are in cents
  };

  const formatPeriod = (period: string) => {
    try {
      // Assuming period is in format "YYYY-MM" or similar
      const [year, month] = period.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString("de-DE", { year: "numeric", month: "long" });
    } catch {
      return period;
    }
  };

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Laden...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">Einnahmen</h1>
        <p className="text-muted-foreground">
          Übersicht über deine Einnahmen und Statements von payments.mojo
        </p>
      </motion.div>

      {statements.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-card/50">
            <CardContent className="p-12 text-center">
              <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Keine Statements vorhanden</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Es sind noch keine Einnahmen-Statements verfügbar.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {statements.map((statement, index) => (
            <motion.div
              key={statement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-card/50 hover:bg-card/70 transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {formatPeriod(statement.period)}
                        </CardTitle>
                        <CardDescription>
                          {statement.transactions} Transaktionen
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(statement.totalRevenue, statement.currency)}
                      </div>
                      <p className="text-sm text-muted-foreground">Gesamteinnahmen</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="w-4 h-4" />
                        Erstellt {new Date(statement.createdAt).toLocaleDateString("de-DE")}
                      </div>
                    {statement.pdfUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(statement.pdfUrl || undefined, "_blank")}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        PDF herunterladen
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

