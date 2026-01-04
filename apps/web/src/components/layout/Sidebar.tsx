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
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useTenant } from '@/providers/TenantProvider';
import { useMemo } from 'react';
import { useToken } from '@/hooks/useToken';
import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '@/lib/api';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { tenants, activeTenant } = useTenant();
  const { getToken } = useToken();

  // Check if active tenant is an organization (not personal)
  const isOrganizationTenant = activeTenant && !activeTenant.isPersonal;
  
  // Check if user has organizations (non-personal tenants) - for showing organization section
  const hasOrganizations = tenants.some(t => !t.isPersonal);

  // Fetch entitlements with React Query (cached)
  const { data: entitlementsData } = useQuery({
    queryKey: ['entitlements', activeTenant?.id],
    queryFn: async () => {
      const token = await getToken();
      return accountsApi.getEntitlements(token);
    },
    enabled: !!activeTenant,
    staleTime: 5 * 60 * 1000, // 5 Minuten
    gcTime: 10 * 60 * 1000, // 10 Minuten im Cache
  });

  // Check if user has campus membership
  const hasCampusMembership = useMemo(() => {
    if (!entitlementsData) return false;
    return entitlementsData.entitlements.some(
      (e) => e.type === 'membership' && 
      (e.resourceName?.toLowerCase().includes('campus') || 
       e.resourceId?.toLowerCase().includes('campus') ||
       e.metadata?.campus === true)
    );
  }, [entitlementsData]);

  // Build navigation sections based on active tenant context
  // Memoize to prevent unnecessary re-renders during navigation
  const sections: UnifiedSidebarSectionConfig[] = useMemo(() => [
    {
      id: 'main',
      title: isOrganizationTenant ? 'Organisation' : 'Konto',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: <LayoutDashboard className="h-5 w-5" />,
          href: '/',
        },
        // Profile is always available
        {
          id: 'profile',
          label: 'Profil',
          icon: <User className="h-5 w-5" />,
          href: '/profile',
        },
        // Only show membership and journey if user has campus membership AND it's personal tenant
        ...(hasCampusMembership && !isOrganizationTenant ? [
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
        ] : []),
      ],
    },
    // Only show organization section if active tenant is an organization
    ...(isOrganizationTenant ? [{
      id: 'organization',
      title: 'Verwaltung',
      items: [
        {
          id: 'team',
          label: 'Teams',
          icon: <Users className="h-5 w-5" />,
          href: '/team',
        },
      ],
    }] : []),
    // Payments section - Einnahmen (for payments.mojo)
    // Only show for organization tenants (revenue is typically organization-related)
    ...(isOrganizationTenant ? [{
      id: 'payments',
      title: 'payments.mojo',
      items: [
        {
          id: 'revenue',
          label: 'Einnahmen',
          icon: <TrendingUp className="h-5 w-5" />,
          href: '/revenue',
        },
      ],
    }] : []),
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
  ], [isOrganizationTenant, hasCampusMembership]);

  return (
    <UnifiedSidebar
      sections={sections}
      pathname={pathname}
      collapsed={collapsed}
      onCollapsedChange={onToggleCollapse}
      // Don't use storageKey - state is managed by DashboardLayout
      // storageKey="accounts-sidebar-collapsed"
    />
  );
}

export default Sidebar;

