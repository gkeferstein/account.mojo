'use client';

/**
 * Header Component
 * Uses MOJO Design System navigation components for the topbar
 * Modeled after payments.mojo implementation
 * 
 * App entitlements are loaded dynamically from the payments.mojo API
 */

import {
  MojoAppSwitcher,
  MojoUserMenu,
  TenantSwitcher,
  MojoLogo,
  MOJO_APPS,
  filterAppsByEntitlements,
} from '@mojo/design';
import { useClerk } from '@clerk/nextjs';
import { useTenant } from '@/providers/TenantProvider';
import type { Tenant, MojoUser } from '@mojo/design';
import { useMemo, useEffect, useState } from 'react';

// Payments.mojo API URL for fetching app entitlements
const PAYMENTS_API_URL = process.env.NEXT_PUBLIC_PAYMENTS_API_URL || 'https://payments.mojo-institut.de/api/v1';

interface AppEntitlementsResponse {
  entitlements: string[];
  isPlatformAdmin: boolean;
}

async function fetchAppEntitlements(userId: string, tenantId: string): Promise<string[]> {
  try {
    const response = await fetch(
      `${PAYMENTS_API_URL}/me/app-entitlements?userId=${encodeURIComponent(userId)}&tenantId=${encodeURIComponent(tenantId)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: AppEntitlementsResponse = await response.json();
    return data.entitlements || [];
  } catch (error) {
    console.error('Failed to fetch app entitlements from payments.mojo:', error);
    return [];
  }
}

export function Header() {
  const { user, tenants, activeTenant, switchTenant, isLoading, error } = useTenant();
  const { signOut } = useClerk();
  const [appEntitlements, setAppEntitlements] = useState<string[]>([]);
  const [isLoadingEntitlements, setIsLoadingEntitlements] = useState(true);

  // Fetch app entitlements from payments.mojo API
  useEffect(() => {
    async function loadAppEntitlements() {
      if (!user?.id || !activeTenant?.id) {
        setIsLoadingEntitlements(false);
        return;
      }

      try {
        const entitlements = await fetchAppEntitlements(user.id, activeTenant.id);
        setAppEntitlements(entitlements);
      } catch (error) {
        console.error('Failed to load app entitlements:', error);
        // Fallback: account.mojo shows only user-accessible apps (no entitlements needed)
        setAppEntitlements([]);
      } finally {
        setIsLoadingEntitlements(false);
      }
    }

    loadAppEntitlements();
  }, [user?.id, activeTenant?.id]);

  const handleLogout = () => {
    signOut({ redirectUrl: '/' });
  };

  // Show loading state
  if (isLoading || isLoadingEntitlements) {
    return (
      <div className="flex w-full items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show error if any
  if (error) {
    return (
      <div className="flex w-full items-center justify-center px-4">
        <MojoLogo size="sm" mode="dark" />
        <span className="ml-2 text-xs text-red-500">Fehler: {error}</span>
      </div>
    );
  }

  // If no user, show minimal header with just the logo
  if (!user || !activeTenant) {
    return (
      <div className="flex w-full items-center justify-center px-4">
        <MojoLogo size="sm" mode="dark" />
        <span className="ml-2 text-xs text-muted-foreground">
          User: {user ? 'OK' : 'fehlt'} | Tenant: {activeTenant ? 'OK' : 'fehlt'}
        </span>
      </div>
    );
  }

  // Map TenantProvider user to MojoUser format
  const mojoUser: MojoUser = {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
    email: user.email,
    imageUrl: user.avatarUrl || undefined,
  };

  // Map current tenant to Mojo Tenant format
  const currentTenant: Tenant = {
    id: activeTenant.id,
    name: activeTenant.name,
    slug: activeTenant.slug,
    type: activeTenant.isPersonal ? 'personal' : 'organization',
    role: activeTenant.role,
  };

  // Map all tenants
  const mojoTenants: Tenant[] = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    type: t.isPersonal ? 'personal' : 'organization',
    role: t.role,
  }));

  // Filter apps based on dynamically loaded entitlements
  const visibleApps = useMemo(
    () => filterAppsByEntitlements(MOJO_APPS, appEntitlements),
    [appEntitlements]
  );

  const handleTenantChange = async (tenant: Tenant) => {
    try {
      await switchTenant(tenant.id);
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  };

  return (
    <div className="flex w-full items-center gap-2 px-4">
      {/* Left: App Switcher */}
      <MojoAppSwitcher
        apps={visibleApps}
        currentApp="account"
      />

      {/* Center: Spacer */}
      <div className="flex-1" />

      {/* Right: Tenant Switcher + User Menu */}
      <div className="flex items-center gap-1">
        <TenantSwitcher
          currentTenant={currentTenant}
          tenants={mojoTenants}
          onTenantChange={handleTenantChange}
          variant="compact"
        />
        <MojoUserMenu
          user={mojoUser}
          tenant={currentTenant}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}
