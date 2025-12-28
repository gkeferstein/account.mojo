"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  Mail,
  MoreVertical,
  Trash2,
  Shield,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useTenant } from "@/providers/TenantProvider";
import { accountsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { getInitials, getRoleDisplayName, formatRelativeTime } from "@/lib/utils";

interface Member {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export default function TeamPage() {
  const { getToken } = useAuth();
  const { activeTenant, user } = useTenant();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    async function fetchTeam() {
      if (!activeTenant) return;

      try {
        const token = await getToken();
        if (!token) return;

        const data = await accountsApi.getTenant(token, activeTenant.id);
        setMembers(data.members);
        setInvitations(data.pendingInvitations);
      } catch (error) {
        console.error("Failed to fetch team:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeam();
  }, [getToken, activeTenant]);

  const handleInvite = async () => {
    if (!activeTenant || !inviteEmail) return;

    setIsInviting(true);
    try {
      const token = await getToken();
      if (!token) return;

      await accountsApi.inviteMember(token, activeTenant.id, {
        email: inviteEmail,
        role: inviteRole,
      });

      toast({
        title: "Einladung gesendet",
        description: `Eine Einladung wurde an ${inviteEmail} gesendet.`,
      });

      setInviteEmail("");
      setShowInviteForm(false);

      // Refresh
      const data = await accountsApi.getTenant(token, activeTenant.id);
      setInvitations(data.pendingInvitations);
    } catch (error) {
      console.error("Failed to invite member:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Einladung konnte nicht gesendet werden.",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!activeTenant) return;

    try {
      const token = await getToken();
      if (!token) return;

      await accountsApi.revokeInvitation(token, activeTenant.id, invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));

      toast({
        title: "Einladung widerrufen",
        description: "Die Einladung wurde widerrufen.",
      });
    } catch (error) {
      console.error("Failed to revoke invitation:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Einladung konnte nicht widerrufen werden.",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeTenant) return;

    try {
      const token = await getToken();
      if (!token) return;

      await accountsApi.removeMember(token, activeTenant.id, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));

      toast({
        title: "Mitglied entfernt",
        description: "Das Mitglied wurde aus dem Team entfernt.",
      });
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Mitglied konnte nicht entfernt werden.",
      });
    }
  };

  if (activeTenant?.isPersonal) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 p-4 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Persönliches Konto</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Team-Verwaltung ist nur für Organisationen verfügbar.
              Erstelle eine Organisation, um ein Team zu verwalten.
            </p>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />

      <main className="flex-1 p-4 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold mb-2">Team</h1>
            <p className="text-muted-foreground">
              Verwalte die Mitglieder von {activeTenant?.name}.
            </p>
          </div>
          <Button onClick={() => setShowInviteForm(!showInviteForm)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Mitglied einladen
          </Button>
        </motion.div>

        {/* Invite Form */}
        {showInviteForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card className="bg-card/50 border-primary/20">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Label>E-Mail-Adresse</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="name@example.com"
                    />
                  </div>
                  <div className="w-full md:w-48">
                    <Label>Rolle</Label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="form-input"
                    >
                      <option value="member">Mitglied</option>
                      <option value="admin">Administrator</option>
                      <option value="billing_admin">Billing Admin</option>
                      <option value="support_readonly">Support (Nur Lesen)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleInvite} loading={isInviting}>
                      Einladen
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* Members */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Mitglieder ({members.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={member.avatarUrl || undefined} />
                          <AvatarFallback>
                            {getInitials(member.firstName, member.lastName, member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {member.firstName} {member.lastName}
                            {member.userId === user?.id && (
                              <span className="ml-2 text-xs text-muted-foreground">(Du)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="badge badge-primary">
                          <Shield className="w-3 h-3 mr-1" />
                          {getRoleDisplayName(member.role)}
                        </span>
                        {member.userId !== user?.id && member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Ausstehende Einladungen ({invitations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-yellow-500" />
                          </div>
                          <div>
                            <p className="font-medium">{invitation.email}</p>
                            <p className="text-sm text-muted-foreground">
                              Eingeladen {formatRelativeTime(invitation.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="badge badge-warning">
                            {getRoleDisplayName(invitation.role)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevokeInvitation(invitation.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

