'use client';

/**
 * Header Component
 * Verwendet die einheitliche MojoTopbar-Komponente aus @gkeferstein/design
 * 
 * Tenant Switcher wird nur angezeigt, wenn der User mehrere Tenants hat (mindestens Personal + 1 Org)
 * App Switcher wurde entfernt
 */

import { MojoTopbar, MojoTopbarSkeleton } from '@gkeferstein/design';
import { useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import type { MojoUser, Tenant } from '@gkeferstein/design';
import { useMemo, useCallback } from 'react';
import { useTenant } from '@/providers/TenantProvider';

export function Header() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const { tenants, activeTenant, switchTenant } = useTenant();

  const handleLogout = useCallback(async () => {
    await signOut();
    router.push('/');
  }, [signOut, router]);

  // Map Clerk user to MojoUser format
  const mojoUser: MojoUser | null = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.firstName || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      imageUrl: clerkUser.imageUrl,
    };
  }, [clerkUser]);

  // Map tenants to MojoTopbar format
  const mojoTenants: Tenant[] = useMemo(() => {
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      type: t.isPersonal ? 'personal' : 'organization',
      role: t.role,
    }));
  }, [tenants]);

  // Current tenant for MojoTopbar
  const currentTenant: Tenant | null = useMemo(() => {
    if (!activeTenant) return null;
    return {
      id: activeTenant.id,
      name: activeTenant.name,
      slug: activeTenant.slug,
      type: activeTenant.isPersonal ? 'personal' : 'organization',
      role: activeTenant.role,
    };
  }, [activeTenant]);

  // Handle tenant switching
  const handleTenantChange = useCallback(async (tenant: Tenant) => {
    try {
      await switchTenant(tenant.id);
    } catch (error) {
      // Error is already logged in TenantProvider
      // The TenantProvider will rollback the change automatically
      // We could show a toast here if needed, but for now just let it fail silently
      console.error("[Header] Tenant switch failed:", error);
    }
  }, [switchTenant]);

  // Show tenant switcher only if user has multiple tenants (at least Personal + 1 Org)
  const hasMultipleTenants = tenants.length > 1;
  const showTenantSwitcher = hasMultipleTenants;

  // Show loading state
  const isLoading = !userLoaded;

  // IMPORTANT: Always pass the current tenant to MojoTopbar, even if there's only one
  // This ensures MojoTopbar uses our data instead of fetching from Clerk directly
  // If we don't pass tenant, MojoTopbar might use useOrganization() internally
  const tenantToPass = activeTenant ? currentTenant : null;

  return (
    <MojoTopbar
      user={mojoUser}
      tenant={tenantToPass}
      tenants={showTenantSwitcher ? mojoTenants : []}
      onTenantChange={showTenantSwitcher ? handleTenantChange : undefined}
      entitlements={[]}
      onLogout={handleLogout}
      isLoading={isLoading}
    />
  );
}
