"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { User, Mail, Phone, Building2, MapPin, Save, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useTenant } from "@/providers/TenantProvider";
import { accountsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface Profile {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  vatId: string | null;
}

export default function ProfilePage() {
  const { getToken } = useAuth();
  const { user, activeTenant } = useTenant();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = await getToken();
        if (!token) return;

        const data = await accountsApi.getProfile(token);
        setProfile(data);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Profil konnte nicht geladen werden.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [getToken, toast]);

  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);
    try {
      const token = await getToken();
      if (!token) return;

      await accountsApi.updateProfile(token, {
        firstName: profile.firstName || undefined,
        lastName: profile.lastName || undefined,
        phone: profile.phone || undefined,
        company: profile.company || undefined,
        street: profile.street || undefined,
        city: profile.city || undefined,
        postalCode: profile.postalCode || undefined,
        country: profile.country || undefined,
        vatId: profile.vatId || undefined,
      });

      toast({
        title: "Gespeichert",
        description: "Dein Profil wurde aktualisiert.",
      });
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Profil konnte nicht gespeichert werden.",
      });
    } finally {
      setIsSaving(false);
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
          <h1 className="text-3xl font-bold mb-2">Profil</h1>
          <p className="text-muted-foreground">
            Verwalte deine persönlichen Daten und Kontaktinformationen.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Avatar Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-card/50">
              <CardContent className="p-6 text-center">
                <Avatar className="w-24 h-24 mx-auto mb-4">
                  <AvatarImage src={user?.avatarUrl || undefined} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {getInitials(user?.firstName, user?.lastName, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-lg">
                  {profile?.firstName} {profile?.lastName}
                </h3>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {activeTenant?.name}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Personal Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Persönliche Daten
                </CardTitle>
                <CardDescription>
                  Deine grundlegenden Kontaktinformationen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-field">
                    <Label>Vorname</Label>
                    <Input
                      value={profile?.firstName || ""}
                      onChange={(e) =>
                        setProfile((p) => (p ? { ...p, firstName: e.target.value } : null))
                      }
                      placeholder="Max"
                    />
                  </div>
                  <div className="form-field">
                    <Label>Nachname</Label>
                    <Input
                      value={profile?.lastName || ""}
                      onChange={(e) =>
                        setProfile((p) => (p ? { ...p, lastName: e.target.value } : null))
                      }
                      placeholder="Mustermann"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    E-Mail
                  </Label>
                  <Input value={profile?.email || ""} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">
                    E-Mail kann in den Clerk-Einstellungen geändert werden.
                  </p>
                </div>

                <div className="form-field">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefon
                  </Label>
                  <Input
                    value={profile?.phone || ""}
                    onChange={(e) =>
                      setProfile((p) => (p ? { ...p, phone: e.target.value } : null))
                    }
                    placeholder="+49 123 456789"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Business Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3"
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Geschäftsdaten
                </CardTitle>
                <CardDescription>
                  Unternehmensdaten für Rechnungen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-field">
                    <Label>Unternehmen</Label>
                    <Input
                      value={profile?.company || ""}
                      onChange={(e) =>
                        setProfile((p) => (p ? { ...p, company: e.target.value } : null))
                      }
                      placeholder="MOJO Institut GmbH"
                    />
                  </div>
                  <div className="form-field">
                    <Label>USt-IdNr.</Label>
                    <Input
                      value={profile?.vatId || ""}
                      onChange={(e) =>
                        setProfile((p) => (p ? { ...p, vatId: e.target.value } : null))
                      }
                      placeholder="DE123456789"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Address */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-3"
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Adresse
                </CardTitle>
                <CardDescription>
                  Rechnungsadresse für dein Konto.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="form-field">
                  <Label>Straße und Hausnummer</Label>
                  <Input
                    value={profile?.street || ""}
                    onChange={(e) =>
                      setProfile((p) => (p ? { ...p, street: e.target.value } : null))
                    }
                    placeholder="Musterstraße 123"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-field">
                    <Label>PLZ</Label>
                    <Input
                      value={profile?.postalCode || ""}
                      onChange={(e) =>
                        setProfile((p) => (p ? { ...p, postalCode: e.target.value } : null))
                      }
                      placeholder="10115"
                    />
                  </div>
                  <div className="form-field">
                    <Label>Stadt</Label>
                    <Input
                      value={profile?.city || ""}
                      onChange={(e) =>
                        setProfile((p) => (p ? { ...p, city: e.target.value } : null))
                      }
                      placeholder="Berlin"
                    />
                  </div>
                  <div className="form-field">
                    <Label>Land</Label>
                    <Input
                      value={profile?.country || ""}
                      onChange={(e) =>
                        setProfile((p) => (p ? { ...p, country: e.target.value } : null))
                      }
                      placeholder="DE"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Speichern...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Änderungen speichern
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

