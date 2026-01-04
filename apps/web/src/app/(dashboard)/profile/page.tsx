"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsFirstMount } from "@/hooks/useIsFirstMount";
import { User, Mail, Phone, MapPin, Save, Loader2, Camera, X, Upload, Image as ImageIcon } from "lucide-react";
import { useTenant } from "@/providers/TenantProvider";
import { accountsApi, ApiError } from "@/lib/api";
import { useToken } from "@/hooks/useToken";
import { useApiError } from "@/hooks/useApiError";
import { ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";

interface Profile {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
}

export default function ProfilePage() {
  const { getToken } = useToken();
  const { user, activeTenant } = useTenant();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { toast } = useToast();
  const { handleError } = useApiError();
  const queryClient = useQueryClient();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isFirstMount = useIsFirstMount();

  // Fetch profile with React Query
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', activeTenant?.id],
    queryFn: async () => {
      const token = await getToken();
      return accountsApi.getProfile(token);
    },
    enabled: !!activeTenant,
    staleTime: 5 * 60 * 1000, // 5 Minuten
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<Profile>) => {
      const token = await getToken();
      return accountsApi.updateProfile(token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({
        title: "Gespeichert",
        description: "Dein Profil wurde aktualisiert.",
      });
    },
    onError: (error) => {
      handleError(error, "Profil konnte nicht gespeichert werden.");
    },
  });

  const handleSave = async () => {
    if (!localProfile) return;

    updateProfileMutation.mutate({
      firstName: localProfile.firstName || undefined,
      lastName: localProfile.lastName || undefined,
      phone: localProfile.phone || undefined,
      street: localProfile.street || undefined,
      city: localProfile.city || undefined,
      postalCode: localProfile.postalCode || undefined,
      country: localProfile.country || undefined,
    });
  };

  const isSaving = updateProfileMutation.isPending;

  // Local state for form editing (optimistic updates)
  // Initialize from React Query data
  const [localProfile, setLocalProfile] = useState<Profile | null>(profile || null);
  
  // Sync local state when profile data loads
  if (profile && (!localProfile || localProfile.email !== profile.email)) {
    setLocalProfile(profile);
  }

  // Update local state when profile data changes
  if (profile && localProfile !== profile) {
    setLocalProfile(profile);
  }

  const handleImageSelect = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ungültiges Format",
        description: "Bitte wähle ein Bild aus (JPG, PNG, etc.).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Datei zu groß",
        description: "Das Bild darf maximal 5MB groß sein.",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Clerk
    handleImageUpload(file);
  }, [toast]);

  const handleImageUpload = async (file: File) => {
    if (!clerkUser) return;

    setIsUploadingImage(true);
    try {
      await clerkUser.setProfileImage({ file });
      
      toast({
        title: "Profilbild aktualisiert",
        description: "Dein Profilbild wurde erfolgreich hochgeladen.",
      });

      // Clear preview after successful upload
      setImagePreview(null);
    } catch (error) {
      console.error("Failed to upload image:", error);
      handleError(error, "Profilbild konnte nicht hochgeladen werden.");
      setImagePreview(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleRemoveImage = async () => {
    if (!clerkUser) return;

    setIsUploadingImage(true);
    try {
      await clerkUser.setProfileImage({ file: null });
      
      toast({
        title: "Profilbild entfernt",
        description: "Dein Profilbild wurde entfernt.",
      });

      setImagePreview(null);
    } catch (error) {
      console.error("Failed to remove image:", error);
      handleError(error, "Profilbild konnte nicht entfernt werden.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const currentImageUrl = imagePreview || clerkUser?.imageUrl || user?.avatarUrl;

  return (
    <>
      <motion.div
        initial={isFirstMount ? { opacity: 0, y: 20 } : false}
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
          initial={isFirstMount ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={isFirstMount ? { delay: 0.1 } : {}}
        >
          <Card className="bg-card/50">
            <CardContent className="p-6 text-center">
              <div className="relative inline-block mb-4">
                <Avatar className="w-32 h-32 mx-auto ring-4 ring-background">
                  <AvatarImage src={currentImageUrl || undefined} />
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {getInitials(user?.firstName, user?.lastName, user?.email)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Upload Overlay */}
                <div
                  className={`absolute inset-0 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity cursor-pointer ${
                    isUploadingImage ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingImage ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                </div>

                {/* Remove Button */}
                {currentImageUrl && !isUploadingImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-lg"
                    title="Profilbild entfernen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div
                className={`mt-4 p-4 rounded-lg border-2 border-dashed transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    {isDragging ? 'Bild hier ablegen' : 'Bild hochladen oder hier ablegen'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG bis 5MB
                  </p>
                </div>
              </div>

              <h3 className="font-semibold text-lg mt-4">
                {localProfile?.firstName} {localProfile?.lastName}
              </h3>
              <p className="text-sm text-muted-foreground">{localProfile?.email}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {activeTenant?.name}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Personal Info */}
        <motion.div
          initial={isFirstMount ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={isFirstMount ? { delay: 0.2 } : {}}
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
                    value={localProfile?.firstName || ""}
                      onChange={(e) =>
                        setLocalProfile((p) => (p ? { ...p, firstName: e.target.value } : null))
                      }
                    placeholder="Max"
                  />
                </div>
                <div className="form-field">
                  <Label>Nachname</Label>
                  <Input
                    value={localProfile?.lastName || ""}
                      onChange={(e) =>
                        setLocalProfile((p) => (p ? { ...p, lastName: e.target.value } : null))
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
                <Input value={localProfile?.email || ""} disabled className="opacity-60" />
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
                  value={localProfile?.phone || ""}
                    onChange={(e) =>
                      setLocalProfile((p) => (p ? { ...p, phone: e.target.value } : null))
                    }
                  placeholder="+49 123 456789"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Address */}
        <motion.div
          initial={isFirstMount ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={isFirstMount ? { delay: 0.3 } : {}}
          className="lg:col-span-3"
        >
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Rechnungsadresse
              </CardTitle>
              <CardDescription>
                Deine Rechnungsadresse für Abonnements und Bestellungen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="form-field">
                <Label>Straße und Hausnummer</Label>
                <Input
                  value={localProfile?.street || ""}
                    onChange={(e) =>
                      setLocalProfile((p) => (p ? { ...p, street: e.target.value } : null))
                    }
                  placeholder="Musterstraße 123"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-field">
                  <Label>PLZ</Label>
                  <Input
                    value={localProfile?.postalCode || ""}
                      onChange={(e) =>
                        setLocalProfile((p) => (p ? { ...p, postalCode: e.target.value } : null))
                      }
                    placeholder="10115"
                  />
                </div>
                <div className="form-field">
                  <Label>Stadt</Label>
                  <Input
                    value={localProfile?.city || ""}
                      onChange={(e) =>
                        setLocalProfile((p) => (p ? { ...p, city: e.target.value } : null))
                      }
                    placeholder="Berlin"
                  />
                </div>
                <div className="form-field">
                  <Label>Land</Label>
                  <Input
                    value={localProfile?.country || ""}
                      onChange={(e) =>
                        setLocalProfile((p) => (p ? { ...p, country: e.target.value } : null))
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
    </>
  );
}
