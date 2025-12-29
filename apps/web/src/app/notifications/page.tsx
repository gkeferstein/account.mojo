'use client';

/**
 * Notifications Settings Page
 * Configure notification preferences across different channels
 */

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, 
  Mail, 
  Sparkles, 
  Users, 
  Shield, 
  CreditCard,
  Megaphone,
  BookOpen,
  Trophy,
  UserPlus,
  AtSign,
  MessageSquare,
  Clock,
  Save,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

interface NotificationGroup {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  settings: NotificationSetting[];
}

// Initial notification settings (mock data)
const initialSettings: NotificationGroup[] = [
  {
    id: 'email',
    title: 'E-Mail Benachrichtigungen',
    description: 'Kontrolliere welche E-Mails du von uns erhältst',
    icon: <Mail className="w-5 h-5" />,
    iconColor: 'text-blue-500',
    settings: [
      {
        id: 'newsletter',
        label: 'Newsletter & Updates',
        description: 'Monatliche Updates zu neuen Features und Inhalten',
        icon: <BookOpen className="w-4 h-4" />,
        enabled: true,
      },
      {
        id: 'marketing',
        label: 'Marketing & Angebote',
        description: 'Informationen über Aktionen und spezielle Angebote',
        icon: <Megaphone className="w-4 h-4" />,
        enabled: false,
      },
      {
        id: 'transactions',
        label: 'Transaktionen',
        description: 'Rechnungen, Zahlungsbestätigungen und Abonnement-Updates',
        icon: <CreditCard className="w-4 h-4" />,
        enabled: true,
        disabled: true,
        disabledReason: 'Erforderlich für Abrechnungszwecke',
      },
      {
        id: 'security',
        label: 'Sicherheitsbenachrichtigungen',
        description: 'Login-Warnungen, Passwortänderungen und Sicherheitshinweise',
        icon: <Shield className="w-4 h-4" />,
        enabled: true,
        disabled: true,
        disabledReason: 'Erforderlich für die Kontosicherheit',
      },
    ],
  },
  {
    id: 'journey',
    title: 'Journey & Kurse',
    description: 'Benachrichtigungen zu deinem MOJO Fortschritt',
    icon: <Sparkles className="w-5 h-5" />,
    iconColor: 'text-primary',
    settings: [
      {
        id: 'reminders',
        label: 'Fortschritts-Erinnerungen',
        description: 'Erinnerungen um deine Journey fortzusetzen',
        icon: <Clock className="w-4 h-4" />,
        enabled: true,
      },
      {
        id: 'new-modules',
        label: 'Neue Module verfügbar',
        description: 'Benachrichtigung wenn neue Kursinhalte freigeschaltet werden',
        icon: <BookOpen className="w-4 h-4" />,
        enabled: true,
      },
      {
        id: 'milestones',
        label: 'Milestone-Benachrichtigungen',
        description: 'Feiere deine erreichten Meilensteine',
        icon: <Trophy className="w-4 h-4" />,
        enabled: true,
      },
    ],
  },
  {
    id: 'team',
    title: 'Team & Community',
    description: 'Updates von deinem Team und der MOJO Community',
    icon: <Users className="w-5 h-5" />,
    iconColor: 'text-green-500',
    settings: [
      {
        id: 'invitations',
        label: 'Team-Einladungen',
        description: 'Einladungen zu Teams und Organisationen',
        icon: <UserPlus className="w-4 h-4" />,
        enabled: true,
      },
      {
        id: 'mentions',
        label: 'Erwähnungen',
        description: 'Wenn dich jemand in einem Kommentar erwähnt',
        icon: <AtSign className="w-4 h-4" />,
        enabled: true,
      },
      {
        id: 'community',
        label: 'Community-Updates',
        description: 'Wichtige Neuigkeiten aus der MOJO Community',
        icon: <MessageSquare className="w-4 h-4" />,
        enabled: true,
      },
    ],
  },
];

function NotificationsContent() {
  const [settings, setSettings] = useState<NotificationGroup[]>(initialSettings);
  const [frequency, setFrequency] = useState('instant');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const handleToggle = (groupId: string, settingId: string) => {
    setSettings(prev => prev.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          settings: group.settings.map(setting => {
            if (setting.id === settingId && !setting.disabled) {
              return { ...setting, enabled: !setting.enabled };
            }
            return setting;
          }),
        };
      }
      return group;
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSaving(false);
    setHasChanges(false);
    
    toast({
      title: 'Einstellungen gespeichert',
      description: 'Deine Benachrichtigungseinstellungen wurden aktualisiert.',
    });
  };

  const enabledCount = settings.reduce(
    (acc, group) => acc + group.settings.filter(s => s.enabled).length,
    0
  );
  const totalCount = settings.reduce((acc, group) => acc + group.settings.length, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Benachrichtigungen</h1>
            <p className="text-muted-foreground">
              Verwalte wie und wann du von uns hörst
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-card border border-border rounded-xl px-4 py-2 flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="text-sm">
                <span className="font-bold">{enabledCount}</span>
                <span className="text-muted-foreground">/{totalCount} aktiv</span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Notification Groups */}
      <div className="space-y-6">
        {settings.map((group, groupIndex) => (
          <motion.div
            key={group.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * groupIndex }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center bg-card border border-border',
                    group.iconColor
                  )}>
                    {group.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{group.title}</CardTitle>
                    <CardDescription>{group.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.settings.map((setting, settingIndex) => (
                  <motion.div
                    key={setting.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * settingIndex }}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-xl border transition-colors',
                      setting.enabled ? 'bg-primary/5 border-primary/20' : 'bg-card border-border',
                      setting.disabled && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                        setting.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      )}>
                        {setting.icon}
                      </div>
                      <div>
                        <Label 
                          htmlFor={`${group.id}-${setting.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {setting.label}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {setting.description}
                        </p>
                        {setting.disabled && setting.disabledReason && (
                          <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {setting.disabledReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      id={`${group.id}-${setting.id}`}
                      checked={setting.enabled}
                      onCheckedChange={() => handleToggle(group.id, setting.id)}
                      disabled={setting.disabled}
                    />
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Frequency Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-card border border-border text-amber-500">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Zusammenfassung</CardTitle>
                  <CardDescription>Wie oft möchtest du Benachrichtigungen erhalten?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="frequency" className="text-sm font-medium">
                    Benachrichtigungshäufigkeit
                  </Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Wähle wie oft du eine Zusammenfassung erhalten möchtest
                  </p>
                </div>
                <Select 
                  value={frequency} 
                  onValueChange={(value) => {
                    setFrequency(value);
                    setHasChanges(true);
                  }}
                  className="w-full md:w-48"
                >
                  <SelectItem value="instant">Sofort</SelectItem>
                  <SelectItem value="daily">Täglich</SelectItem>
                  <SelectItem value="weekly">Wöchentlich</SelectItem>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-end"
      >
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || isSaving}
          className="gap-2"
          size="lg"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Speichern...
            </>
          ) : hasChanges ? (
            <>
              <Save className="w-4 h-4" />
              Änderungen speichern
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Gespeichert
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <DashboardLayout>
      <NotificationsContent />
    </DashboardLayout>
  );
}

