'use client';

/**
 * Sidebar Component
 * Uses MOJO Design System UnifiedSidebar for consistent navigation structure
 * Modeled after payments.mojo implementation
 * 
 * The collapsed state is managed by the parent (DashboardLayout)
 * to keep MojoShell and UnifiedSidebar in sync.
 */

import { usePathname } from 'next/navigation';
import { UnifiedSidebar } from '@gkeferstein/design';
import type { UnifiedSidebarSectionConfig } from '@gkeferstein/design';
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

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  // Build navigation sections
  const sections: UnifiedSidebarSectionConfig[] = [
    {
      id: 'main',
      title: 'Konto',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: <LayoutDashboard className="h-5 w-5" />,
          href: '/',
        },
        {
          id: 'profile',
          label: 'Profil',
          icon: <User className="h-5 w-5" />,
          href: '/profile',
        },
        {
          id: 'membership',
          label: 'Mitgliedschaft',
          icon: <CreditCard className="h-5 w-5" />,
          href: '/membership',
        },
        {
          id: 'journey',
          label: 'Meine MOJO Journey',
          icon: <Sparkles className="h-5 w-5" />,
          href: '/journey',
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
        },
        {
          id: 'organizations',
          label: 'Organisationen',
          icon: <Building2 className="h-5 w-5" />,
          href: '/organizations',
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
        },
        {
          id: 'notifications',
          label: 'Benachrichtigungen',
          icon: <Bell className="h-5 w-5" />,
          href: '/notifications',
        },
        {
          id: 'api-keys',
          label: 'API Keys',
          icon: <Key className="h-5 w-5" />,
          href: '/api-keys',
        },
        {
          id: 'preferences',
          label: 'Präferenzen',
          icon: <Settings className="h-5 w-5" />,
          href: '/preferences',
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
        },
        {
          id: 'support',
          label: 'Hilfe & Support',
          icon: <HelpCircle className="h-5 w-5" />,
          href: '/support',
        },
      ],
    },
  ];

  return (
    <UnifiedSidebar
      sections={sections}
      pathname={pathname}
      collapsed={collapsed}
      onCollapsedChange={onToggleCollapse}
      storageKey="accounts-sidebar-collapsed"
    />
  );
}

export default Sidebar;

