"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Settings, Bell, Mail, Globe, Save, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { accountsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface Preferences {
  newsletter: boolean;
  productUpdates: boolean;
  marketingEmails: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  language: string;
  timezone: string;
}

export default function PreferencesPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const token = await getToken();
        if (!token) return;

        const data = await accountsApi.getPreferences(token);
        setPreferences(data);
      } catch (error) {
        console.error("Failed to fetch preferences:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreferences();
  }, [getToken]);

  const handleSave = async () => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      const token = await getToken();
      if (!token) return;

      await accountsApi.updatePreferences(token, preferences);

      toast({
        title: "Gespeichert",
        description: "Deine Einstellungen wurden aktualisiert.",
      });
    } catch (error) {
      console.error("Failed to save preferences:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreference = (key: keyof Preferences, value: boolean | string) => {
    setPreferences((prev) => (prev ? { ...prev, [key]: value } : null));
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
          <h1 className="text-3xl font-bold mb-2">Einstellungen</h1>
          <p className="text-muted-foreground">
            Passe deine Benachrichtigungs- und Kommunikationseinstellungen an.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  E-Mail Benachrichtigungen
                </CardTitle>
                <CardDescription>
                  Wähle, welche E-Mails du erhalten möchtest.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Newsletter</Label>
                    <p className="text-sm text-muted-foreground">
                      Neuigkeiten und Updates vom MOJO Institut
                    </p>
                  </div>
                  <Switch
                    checked={preferences?.newsletter ?? false}
                    onCheckedChange={(v) => updatePreference("newsletter", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Produkt-Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Neue Funktionen und Verbesserungen
                    </p>
                  </div>
                  <Switch
                    checked={preferences?.productUpdates ?? false}
                    onCheckedChange={(v) => updatePreference("productUpdates", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Marketing E-Mails</Label>
                    <p className="text-sm text-muted-foreground">
                      Angebote und Promotionen
                    </p>
                  </div>
                  <Switch
                    checked={preferences?.marketingEmails ?? false}
                    onCheckedChange={(v) => updatePreference("marketingEmails", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Benachrichtigungen
                </CardTitle>
                <CardDescription>
                  Verwalte deine System-Benachrichtigungen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>E-Mail Benachrichtigungen</Label>
                    <p className="text-sm text-muted-foreground">
                      Wichtige Account-Benachrichtigungen per E-Mail
                    </p>
                  </div>
                  <Switch
                    checked={preferences?.emailNotifications ?? false}
                    onCheckedChange={(v) => updatePreference("emailNotifications", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Push-Benachrichtigungen</Label>
                    <p className="text-sm text-muted-foreground">
                      Browser-Benachrichtigungen (falls unterstützt)
                    </p>
                  </div>
                  <Switch
                    checked={preferences?.pushNotifications ?? false}
                    onCheckedChange={(v) => updatePreference("pushNotifications", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Regional Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Regionale Einstellungen
                </CardTitle>
                <CardDescription>
                  Sprache und Zeitzone für dein Konto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-field">
                    <Label>Sprache</Label>
                    <select
                      value={preferences?.language ?? "de"}
                      onChange={(e) => updatePreference("language", e.target.value)}
                      className="form-input"
                    >
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <Label>Zeitzone</Label>
                    <select
                      value={preferences?.timezone ?? "Europe/Berlin"}
                      onChange={(e) => updatePreference("timezone", e.target.value)}
                      className="form-input"
                    >
                      <option value="Europe/Berlin">Berlin (GMT+1/+2)</option>
                      <option value="Europe/Vienna">Wien (GMT+1/+2)</option>
                      <option value="Europe/Zurich">Zürich (GMT+1/+2)</option>
                      <option value="Europe/London">London (GMT/+1)</option>
                      <option value="America/New_York">New York (GMT-5/-4)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Speichern...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Einstellungen speichern
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}


