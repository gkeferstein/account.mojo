"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Key, Smartphone, Lock, AlertTriangle, Eye, EyeOff, Trash2, Monitor, Globe, MapPin, LogOut, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsFirstMount } from "@/hooks/useIsFirstMount";
import { useUser } from "@clerk/nextjs";
import { useToast } from "@/components/ui/use-toast";

export default function SecurityPage() {
  const isFirstMount = useIsFirstMount();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 2FA state
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Check if user has 2FA enabled
  const hasTwoFactor = user?.twoFactorEnabled || false;

  // Load sessions
  const loadSessions = async () => {
    if (!user) return;
    
    setIsLoadingSessions(true);
    try {
      const allSessions = await user.getSessions();
      setSessions(allSessions);
      
      // Get current session ID (use first session as fallback)
      const currentSession = allSessions.find((s) => s.id === (user as any).lastActiveSessionId) || allSessions[0];
      if (currentSession) {
        setCurrentSessionId(currentSession.id);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      toast({
        title: "Fehler",
        description: "Sitzungen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Load sessions on mount
  useEffect(() => {
    if (isLoaded && user) {
      loadSessions();
    }
  }, [isLoaded, user]);

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Die neuen Passwörter stimmen nicht überein.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Fehler",
        description: "Das Passwort muss mindestens 8 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await user?.updatePassword({
        currentPassword,
        newPassword,
      });

      toast({
        title: "Erfolgreich",
        description: "Dein Passwort wurde erfolgreich geändert.",
      });

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Failed to change password:", error);
      toast({
        title: "Fehler",
        description: error?.errors?.[0]?.message || "Passwort konnte nicht geändert werden.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle 2FA enable
  const handleEnable2FA = async () => {
    setIsEnabling2FA(true);
    try {
      // Create a new 2FA enrollment using TOTP
      // Note: createEnrollment may not be available in all Clerk versions
      const enrollment = await (user as any)?.createEnrollment?.({
        strategy: "totp",
      });

      if (enrollment) {
        toast({
          title: "2FA Setup gestartet",
          description: "Bitte folge den Anweisungen, um 2FA zu aktivieren.",
        });
        // Reload user to get updated 2FA status
        await user?.reload();
      }
    } catch (error: any) {
      console.error("Failed to enable 2FA:", error);
      toast({
        title: "Fehler",
        description: error?.errors?.[0]?.message || "2FA konnte nicht aktiviert werden.",
        variant: "destructive",
      });
    } finally {
      setIsEnabling2FA(false);
    }
  };

  // Handle 2FA disable
  const handleDisable2FA = async () => {
    if (!confirm("Möchtest du die Zwei-Faktor-Authentifizierung wirklich deaktivieren? Dies reduziert die Sicherheit deines Kontos.")) {
      return;
    }

    setIsDisabling2FA(true);
    try {
      // Get all 2FA enrollments and delete them
      // Note: twoFactorEnabledMethods and deleteEnrollment may not be available in all Clerk versions
      const enrollments = (user as any)?.twoFactorEnabledMethods;
      if (enrollments && enrollments.length > 0) {
        for (const enrollment of enrollments) {
          await (user as any)?.deleteEnrollment?.(enrollment.id);
        }
      }

      toast({
        title: "2FA deaktiviert",
        description: "Zwei-Faktor-Authentifizierung wurde deaktiviert.",
      });
      // Reload user to get updated 2FA status
      await user?.reload();
    } catch (error: any) {
      console.error("Failed to disable 2FA:", error);
      toast({
        title: "Fehler",
        description: error?.errors?.[0]?.message || "2FA konnte nicht deaktiviert werden.",
        variant: "destructive",
      });
    } finally {
      setIsDisabling2FA(false);
    }
  };

  // Handle session revocation
  const handleRevokeSession = async (sessionId: string) => {
    if (sessionId === currentSessionId) {
      toast({
        title: "Hinweis",
        description: "Du kannst deine aktuelle Sitzung nicht beenden.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Möchtest du diese Sitzung wirklich beenden?")) {
      return;
    }

    try {
      // Note: revokeSession may not be available in all Clerk versions
      await (user as any)?.revokeSession?.(sessionId);
      toast({
        title: "Sitzung beendet",
        description: "Die Sitzung wurde erfolgreich beendet.",
      });
      // Reload sessions
      await loadSessions();
    } catch (error: any) {
      console.error("Failed to revoke session:", error);
      toast({
        title: "Fehler",
        description: error?.errors?.[0]?.message || "Sitzung konnte nicht beendet werden.",
        variant: "destructive",
      });
    }
  };

  // Handle revoke all other sessions
  const handleRevokeAllOtherSessions = async () => {
    if (!confirm("Möchtest du wirklich alle anderen Sitzungen beenden? Du wirst auf allen anderen Geräten ausgeloggt.")) {
      return;
    }

    try {
      const otherSessions = sessions.filter((s) => s.id !== currentSessionId);
      for (const session of otherSessions) {
        try {
          await user?.revokeSession(session.id);
        } catch (error) {
          console.error(`Failed to revoke session ${session.id}:`, error);
        }
      }
      toast({
        title: "Sitzungen beendet",
        description: `Alle anderen Sitzungen (${otherSessions.length}) wurden beendet.`,
      });
      // Reload sessions
      await loadSessions();
    } catch (error: any) {
      console.error("Failed to revoke sessions:", error);
      toast({
        title: "Fehler",
        description: error?.errors?.[0]?.message || "Sitzungen konnten nicht beendet werden.",
        variant: "destructive",
      });
    }
  };

  // Format device information
  const getDeviceInfo = (session: any) => {
    const device = session.device || {};
    const browser = device.browserName || device.browser || "Unbekannt";
    const os = device.osName || device.os || "Unbekannt";
    const deviceType = device.type || "Unbekannt";
    
    return {
      browser,
      os,
      deviceType,
      fullInfo: `${browser} auf ${os}`,
    };
  };

  // Format location information
  const getLocationInfo = (session: any) => {
    const ipAddress = session.ipAddress || "Unbekannt";
    const location = session.location || {};
    const city = location.city || "";
    const country = location.country || "";
    
    let locationStr = "";
    if (city && country) {
      locationStr = `${city}, ${country}`;
    } else if (country) {
      locationStr = country;
    } else {
      locationStr = "Unbekannt";
    }
    
    return { ipAddress, location: locationStr };
  };

  // Format date
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Unbekannt";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get relative time
  const getRelativeTime = (date: Date | string | null | undefined) => {
    if (!date) return "Unbekannt";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Gerade eben";
    if (diffMins < 60) return `Vor ${diffMins} Minute${diffMins > 1 ? "n" : ""}`;
    if (diffHours < 24) return `Vor ${diffHours} Stunde${diffHours > 1 ? "n" : ""}`;
    if (diffDays < 7) return `Vor ${diffDays} Tag${diffDays > 1 ? "en" : ""}`;
    return formatDate(d);
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={isFirstMount ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          Sicherheit
        </h1>
        <p className="text-muted-foreground">
          Verwalte deine Sicherheitseinstellungen, Passwort und Zwei-Faktor-Authentifizierung.
        </p>
      </motion.div>

      <div className="space-y-6">
        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={isFirstMount ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={isFirstMount ? { delay: 0.1 } : {}}
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Zwei-Faktor-Authentifizierung
                </CardTitle>
                <CardDescription>
                  Erhöhe die Sicherheit deines Kontos mit 2FA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium">
                      {hasTwoFactor ? "Aktiviert" : "Nicht aktiviert"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {hasTwoFactor
                        ? "Dein Konto ist durch 2FA geschützt"
                        : "Aktiviere 2FA für zusätzlichen Schutz"}
                    </p>
                  </div>
                  {hasTwoFactor ? (
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  )}
                </div>
                {hasTwoFactor ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisable2FA}
                    disabled={isDisabling2FA}
                  >
                    {isDisabling2FA ? "Deaktivieren..." : "2FA deaktivieren"}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleEnable2FA}
                    disabled={isEnabling2FA}
                  >
                    {isEnabling2FA ? "Aktivieren..." : "2FA aktivieren"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={isFirstMount ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={isFirstMount ? { delay: 0.2 } : {}}
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Aktive Sitzungen
                </CardTitle>
                <CardDescription>
                  {sessions.length > 0 ? `${sessions.length} aktive Sitzung(en)` : "Keine Sitzungen geladen"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSessions}
                  disabled={isLoadingSessions}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingSessions ? "animate-spin" : ""}`} />
                  {isLoadingSessions ? "Laden..." : "Aktualisieren"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Password Change Form */}
      <motion.div
          initial={isFirstMount ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
          transition={isFirstMount ? { delay: 0.3 } : {}}
        >
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Passwort ändern
              </CardTitle>
              <CardDescription>
                Ändere dein Passwort, um dein Konto sicher zu halten
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="form-field">
                  <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Aktuelles Passwort"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <Label htmlFor="newPassword">Neues Passwort</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Neues Passwort (min. 8 Zeichen)"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? "Ändern..." : "Passwort ändern"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Sessions List */}
        <motion.div
          initial={isFirstMount ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={isFirstMount ? { delay: 0.4 } : {}}
        >
          <Card className="bg-card/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="w-5 h-5" />
                    Aktive Geräte & Sitzungen
                  </CardTitle>
                  <CardDescription>
                    Verwalte alle Geräte, die auf dein Konto zugreifen
                  </CardDescription>
                </div>
                {sessions.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevokeAllOtherSessions}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Alle anderen beenden
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Laden...</div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Monitor className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Keine aktiven Sitzungen gefunden
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSessions}
                    className="mt-4"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sitzungen laden
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => {
                    const isCurrentSession = session.id === currentSessionId;
                    const deviceInfo = getDeviceInfo(session);
                    const locationInfo = getLocationInfo(session);
                    
                    return (
                      <div
                        key={session.id}
                        className={`p-4 rounded-lg border ${
                          isCurrentSession
                            ? "border-primary bg-primary/5"
                            : "border-border bg-secondary/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${
                              isCurrentSession
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              <Monitor className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium">
                                  {deviceInfo.fullInfo}
                                </p>
                                {isCurrentSession && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                    Aktuell
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <div className="flex items-center gap-4">
                                  <span className="flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    {deviceInfo.browser}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Monitor className="w-3 h-3" />
                                    {deviceInfo.os}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {locationInfo.location}
                                  </span>
                                  <span>IP: {locationInfo.ipAddress}</span>
                                </div>
                                <div>
                                  Letzte Aktivität: {getRelativeTime(session.lastActiveAt)}
                                  {session.lastActiveAt && (
                                    <span className="ml-2">
                                      ({formatDate(session.lastActiveAt)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          {!isCurrentSession && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeSession(session.id)}
                              className="shrink-0"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Beenden
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Tips */}
        <motion.div
          initial={isFirstMount ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={isFirstMount ? { delay: 0.5 } : {}}
        >
          <Card className="bg-card/50 border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="w-5 h-5" />
                Sicherheitstipps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>Verwende ein starkes, einzigartiges Passwort</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>Aktiviere die Zwei-Faktor-Authentifizierung für zusätzlichen Schutz</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>Überprüfe regelmäßig deine aktiven Geräte und Sitzungen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>Melde verdächtige Aktivitäten sofort</span>
                </li>
              </ul>
            </CardContent>
          </Card>
      </motion.div>
      </div>
    </>
  );
}

