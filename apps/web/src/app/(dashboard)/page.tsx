"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useToken } from "@/hooks/useToken";
import { useApiError } from "@/hooks/useApiError";
import {
  CreditCard,
  Users,
  Shield,
  ChevronRight,
  Award,
  BookOpen,
  Bell,
  Database,
} from "lucide-react";
import { useTenant } from "@/providers/TenantProvider";
import { accountsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, formatDate, getStatusDisplayName } from "@/lib/utils";
import Link from "next/link";

interface DashboardData {
  subscription: {
    status: string;
    planName: string;
    currentPeriodEnd: string;
  } | null;
  entitlements: number;
  teamMembers: number;
}

export default function DashboardPage() {
  const { getToken } = useToken();
  const { user, activeTenant, isLoading: tenantLoading } = useTenant();
  const { handleError } = useApiError();

  // Fetch subscription with React Query
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', activeTenant?.id],
    queryFn: async () => {
      const token = await getToken();
      return accountsApi.getSubscription(token);
    },
    enabled: !!activeTenant && !tenantLoading,
    staleTime: 1 * 60 * 1000, // 1 Minute
  });

  // Fetch entitlements with React Query
  const { data: entitlementsData, isLoading: isLoadingEntitlements } = useQuery({
    queryKey: ['entitlements', activeTenant?.id],
    queryFn: async () => {
      const token = await getToken();
      return accountsApi.getEntitlements(token);
    },
    enabled: !!activeTenant && !tenantLoading,
    staleTime: 5 * 60 * 1000, // 5 Minuten
  });

  // Combine data
  const data: DashboardData | null = useMemo(() => {
    if (!subscriptionData || !entitlementsData) return null;
    return {
      subscription: subscriptionData.subscription,
      entitlements: entitlementsData.total,
      teamMembers: 1, // Would fetch from tenant details
    };
  }, [subscriptionData, entitlementsData]);

  const isLoading = isLoadingSubscription || isLoadingEntitlements;

  // Profile completeness calculation
  const profileComplete = user ? [
    user.firstName,
    user.lastName,
    user.email,
  ].filter(Boolean).length * 33 : 0;

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">
          Willkommen zurück{user?.firstName ? `, ${user.firstName}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground">
          Hier ist eine Übersicht deines MOJO Kontos.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-card/50 card-hover">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="text-lg font-semibold">
                    {data?.subscription
                      ? getStatusDisplayName(data.subscription.status)
                      : "Kein Abo"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card/50 card-hover">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <Award className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Berechtigungen</p>
                  <p className="text-lg font-semibold">
                    {data?.entitlements || 0} aktiv
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-card/50 card-hover">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team</p>
                  <p className="text-lg font-semibold">
                    {activeTenant?.isPersonal ? "Persönlich" : `${data?.teamMembers || 1} Mitglieder`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-card/50 card-hover">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sicherheit</p>
                  <p className="text-lg font-semibold">Geschützt</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Completeness */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle>Profil vervollständigen</CardTitle>
              <CardDescription>
                Vervollständige dein Profil für ein besseres Erlebnis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fortschritt</span>
                  <span className="font-medium">{profileComplete}%</span>
                </div>
                <Progress value={profileComplete} />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <Link href="/profile">
                    <div className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user?.avatarUrl || undefined} />
                          <AvatarFallback>
                            {getInitials(user?.firstName, user?.lastName, user?.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Profil bearbeiten</p>
                          <p className="text-xs text-muted-foreground">Name & Kontakt</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>

                  <Link href="/security">
                    <div className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Sicherheit</p>
                          <p className="text-xs text-muted-foreground">2FA & Passwort</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>

                  <Link href="/preferences">
                    <div className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Bell className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Benachrichtigungen</p>
                          <p className="text-xs text-muted-foreground">E-Mail & Push</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-card/50 h-full">
            <CardHeader>
              <CardTitle>Schnellzugriff</CardTitle>
              <CardDescription>
                Häufig verwendete Funktionen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/membership">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <CreditCard className="w-4 h-4" />
                  Abonnement verwalten
                </Button>
              </Link>
              
              {!activeTenant?.isPersonal && (
                <Link href="/team">
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <Users className="w-4 h-4" />
                    Team verwalten
                  </Button>
                </Link>
              )}
              
              <Link href="/data">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Database className="w-4 h-4" />
                  Daten exportieren
                </Button>
              </Link>
              
              <a
                href="https://campus.mojo-institut.de"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full justify-start gap-3">
                  <BookOpen className="w-4 h-4" />
                  Zum MOJO Campus
                </Button>
              </a>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Subscription Banner */}
      {data?.subscription && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6"
        >
          <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">
                    {data.subscription.planName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Aktiv bis {formatDate(data.subscription.currentPeriodEnd)}
                  </p>
                </div>
                <Link href="/membership">
                  <Button>
                    Verwalten
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </>
  );
}
