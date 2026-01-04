"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useToken } from "@/hooks/useToken";
import { useApiError } from "@/hooks/useApiError";
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  Shield,
  Clock,
  Building2,
  ChevronRight,
} from "lucide-react";
import { useTenant } from "@/providers/TenantProvider";
import { accountsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { getToken } = useToken();
  const { tenants, activeTenant, user, switchTenant } = useTenant();
  const { toast } = useToast();
  const { handleError } = useApiError();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  // Filter out personal tenants - only show organizations
  const organizations = tenants.filter(t => !t.isPersonal);
  
  // Use selected tenant or active tenant (if it's an organization)
  const currentTenant = selectedTenantId 
    ? organizations.find(t => t.id === selectedTenantId)
    : (activeTenant && !activeTenant.isPersonal ? activeTenant : organizations[0] || null);

  useEffect(() => {
    async function fetchTeam() {
      if (!currentTenant) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const token = await getToken();
        const data = await accountsApi.getTenant(token, currentTenant.id);
        setMembers(data.members);
        setInvitations(data.pendingInvitations);
      } catch (error) {
        handleError(error, "Team konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeam();
  }, [getToken, currentTenant]);

  const handleInvite = async () => {
    if (!currentTenant || !inviteEmail) return;

    setIsInviting(true);
    try {
      const token = await getToken();
      await accountsApi.inviteMember(token, currentTenant.id, {
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
      const data = await accountsApi.getTenant(token, currentTenant.id);
      setInvitations(data.pendingInvitations);
    } catch (error) {
      handleError(error, "Einladung konnte nicht gesendet werden.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!currentTenant) return;

    try {
      const token = await getToken();
      await accountsApi.revokeInvitation(token, currentTenant.id, invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));

      toast({
        title: "Einladung widerrufen",
        description: "Die Einladung wurde widerrufen.",
      });
    } catch (error) {
      handleError(error, "Einladung konnte nicht widerrufen werden.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentTenant) return;

    try {
      const token = await getToken();
      await accountsApi.removeMember(token, currentTenant.id, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));

      toast({
        title: "Mitglied entfernt",
        description: "Das Mitglied wurde aus dem Team entfernt.",
      });
    } catch (error) {
      handleError(error, "Mitglied konnte nicht entfernt werden.");
    }
  };

  // If user has no organizations, show message
  if (organizations.length === 0) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Keine Organisationen</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Du bist noch keinem Team beigetreten oder hast keine Organisation erstellt.
            Organisationen werden über Clerk verwaltet.
          </p>
        </motion.div>
      </>
    );
  }

  const handleSelectTenant = async (tenantId: string) => {
    setSelectedTenantId(tenantId);
    // Optionally switch active tenant
    try {
      await switchTenant(tenantId);
    } catch (error) {
      // If switching fails, we still show the team for the selected tenant
      console.error("Failed to switch tenant:", error);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Teams</h1>
            <p className="text-muted-foreground">
              Verwalte die Mitglieder deiner Organisationen.
            </p>
          </div>
          {currentTenant && (
            <Button onClick={() => setShowInviteForm(!showInviteForm)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Mitglied einladen
            </Button>
          )}
        </div>

        {/* Organization Selector */}
        {organizations.length > 1 && (
          <div className="mb-6">
            <Label className="mb-2 block">Organisation auswählen</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {organizations.map((org) => (
                <Card
                  key={org.id}
                  className={`cursor-pointer transition-all hover:border-primary ${
                    currentTenant?.id === org.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                  onClick={() => handleSelectTenant(org.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {getRoleDisplayName(org.role)}
                          </p>
                        </div>
                      </div>
                      {currentTenant?.id === org.id && (
                        <ChevronRight className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {!currentTenant ? (
        <Card className="bg-card/50">
          <CardContent className="p-8 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Bitte wähle eine Organisation aus, um deren Team zu verwalten.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
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
                  <Button onClick={handleInvite} disabled={isInviting}>
                    {isInviting ? "Laden..." : "Einladen"}
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
        </>
      )}
    </>
  );
}
