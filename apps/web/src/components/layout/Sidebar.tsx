'use client';

/**
 * Sidebar Component
 * Uses MOJO Design System MojoSidebar with proper navigation structure
 * Modeled after payments.mojo implementation
 * 
 * The collapsed state is managed by the parent (DashboardLayout)
 * to keep MojoShell and MojoSidebar in sync.
 */

import { usePathname } from 'next/navigation';
import { MojoSidebar, MojoLogo, MojoIcon } from '@mojo/design';
import type { SidebarItem } from '@mojo/design';
import {
  LayoutDashboard,
  User,
  CreditCard,
  Users,
  Shield,
  Settings,
  Database,
  HelpCircle,
  Building2,
  Bell,
  Key,
  Sparkles,
} from 'lucide-react';

// Define SidebarSection type (matches @mojo/design)
interface SidebarSection {
  id: string;
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  // Build navigation sections
  const sections: SidebarSection[] = [
    {
      id: 'main',
      title: 'Konto',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: <LayoutDashboard className="h-5 w-5" />,
          href: '/',
          active: pathname === '/',
        },
        {
          id: 'profile',
          label: 'Profil',
          icon: <User className="h-5 w-5" />,
          href: '/profile',
          active: pathname === '/profile' || pathname?.startsWith('/profile/'),
        },
        {
          id: 'membership',
          label: 'Mitgliedschaft',
          icon: <CreditCard className="h-5 w-5" />,
          href: '/membership',
          active: pathname === '/membership',
        },
        {
          id: 'journey',
          label: 'Meine MOJO Journey',
          icon: <Sparkles className="h-5 w-5" />,
          href: '/journey',
          active: pathname === '/journey' || pathname?.startsWith('/journey/'),
        },
      ],
    },
    {
      id: 'organization',
      title: 'Organisation',
      items: [
        {
          id: 'team',
          label: 'Team',
          icon: <Users className="h-5 w-5" />,
          href: '/team',
          active: pathname === '/team' || pathname?.startsWith('/team/'),
        },
        {
          id: 'organizations',
          label: 'Organisationen',
          icon: <Building2 className="h-5 w-5" />,
          href: '/organizations',
          active: pathname === '/organizations' || pathname?.startsWith('/organizations/'),
        },
      ],
    },
    {
      id: 'settings',
      title: 'Einstellungen',
      items: [
        {
          id: 'security',
          label: 'Sicherheit',
          icon: <Shield className="h-5 w-5" />,
          href: '/security',
          active: pathname === '/security' || pathname?.startsWith('/security/'),
        },
        {
          id: 'notifications',
          label: 'Benachrichtigungen',
          icon: <Bell className="h-5 w-5" />,
          href: '/notifications',
          active: pathname === '/notifications',
        },
        {
          id: 'api-keys',
          label: 'API Keys',
          icon: <Key className="h-5 w-5" />,
          href: '/api-keys',
          active: pathname === '/api-keys' || pathname?.startsWith('/api-keys/'),
        },
        {
          id: 'preferences',
          label: 'Präferenzen',
          icon: <Settings className="h-5 w-5" />,
          href: '/preferences',
          active: pathname === '/preferences',
        },
      ],
    },
    {
      id: 'data',
      title: 'Daten',
      items: [
        {
          id: 'data-privacy',
          label: 'Daten & Privatsphäre',
          icon: <Database className="h-5 w-5" />,
          href: '/data',
          active: pathname === '/data' || pathname?.startsWith('/data/'),
        },
        {
          id: 'support',
          label: 'Hilfe & Support',
          icon: <HelpCircle className="h-5 w-5" />,
          href: '/support',
          active: pathname === '/support' || pathname?.startsWith('/support/'),
        },
      ],
    },
  ];

  return (
    <MojoSidebar
      logo={<MojoLogo size="sm" mode="dark" />}
      collapsedLogo={<MojoIcon size={28} mode="dark" />}
      sections={sections}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      collapsible
    />
  );
}

export default Sidebar;

