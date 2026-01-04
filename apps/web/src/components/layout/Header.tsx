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
  const { tenants, activeTenant, switchTenant, user } = useTenant();

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

  // Check if user is platform admin
  const isPlatformAdmin = user?.platformRole === 'platform_admin';

  // Map tenants to MojoTopbar format
  // For platform admins, add "(Platform)" suffix to ALL non-personal tenants to clearly distinguish them
  const mojoTenants: Tenant[] = useMemo(() => {
    if (!isPlatformAdmin) {
      // Default: no modification for non-platform admins
      return tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        type: t.isPersonal ? 'personal' : 'organization',
        role: t.role,
      }));
    }

    // For platform admins: mark all non-personal tenants with "(Platform)"
    const orgTenants = tenants.filter(t => !t.isPersonal);
    
    // Group org tenants by name to detect duplicates
    const nameGroups = new Map<string, typeof tenants>();
    orgTenants.forEach(t => {
      if (!nameGroups.has(t.name)) {
        nameGroups.set(t.name, []);
      }
      nameGroups.get(t.name)!.push(t);
    });

    return tenants.map((t) => {
      let displayName = t.name;
      
      // If user is platform admin, mark ALL non-personal tenants with "(Platform)" suffix
      if (!t.isPersonal) {
        const sameNameTenants = nameGroups.get(t.name) || [];
        
        // If there are multiple tenants with the same name, add a number
        if (sameNameTenants.length > 1) {
          const index = sameNameTenants.findIndex(tenant => tenant.id === t.id);
          displayName = `${t.name} (Platform ${index + 1})`;
        } else {
          displayName = `${t.name} (Platform)`;
        }
      }
      
      return {
        id: t.id,
        name: displayName,
        slug: t.slug,
        type: t.isPersonal ? 'personal' : 'organization',
        role: t.role,
      };
    });
  }, [tenants, isPlatformAdmin]);

  // Current tenant for MojoTopbar
  // Apply same naming logic as mojoTenants for consistency
  const currentTenant: Tenant | null = useMemo(() => {
    if (!activeTenant) return null;
    
    // Apply same naming logic as mojoTenants
    let displayName = activeTenant.name;
    
    // If user is platform admin, mark non-personal tenant with "(Platform)" suffix
    if (isPlatformAdmin && !activeTenant.isPersonal) {
      // Check if there are multiple org tenants with the same name
      const orgTenants = tenants.filter(t => !t.isPersonal && t.name === activeTenant.name);
      
      if (orgTenants.length > 1) {
        const index = orgTenants.findIndex(t => t.id === activeTenant.id);
        displayName = `${activeTenant.name} (Platform ${index + 1})`;
      } else {
        displayName = `${activeTenant.name} (Platform)`;
      }
    }
    
    return {
      id: activeTenant.id,
      name: displayName,
      slug: activeTenant.slug,
      type: activeTenant.isPersonal ? 'personal' : 'organization',
      role: activeTenant.role,
    };
  }, [activeTenant, isPlatformAdmin, tenants]);

  // Handle tenant switching
  const handleTenantChange = useCallback(async (tenant: Tenant) => {
    try {
      await switchTenant(tenant.id);
    } catch (error) {
      // Error is already logged in TenantProvider
      // The TenantProvider will rollback the change automatically
      // Only log in development to reduce console noise
      if (process.env.NODE_ENV === 'development') {
        console.error("[Header] Tenant switch failed:", error);
      }
      // We could show a toast here if needed, but for now just let it fail silently
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
      currentApp="accounts"
      isLoading={isLoading}
    />
  );
}
