'use client';

/**
 * Header Component
 * Verwendet die einheitliche MojoTopbar-Komponente aus @mojo/design
 * 
 * Uses Clerk Organizations for tenant management
 */

import { MojoTopbar, MojoTopbarSkeleton } from '@mojo/design';
import { useClerk, useOrganizationList, useOrganization, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import type { Tenant, MojoUser } from '@mojo/design';
import { useMemo, useCallback } from 'react';

export function Header() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();
  const { organization: activeOrg } = useOrganization();
  const { userMemberships, isLoaded: membershipsLoaded, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await signOut();
    router.push('/');
  }, [signOut, router]);

  // Build current tenant from active Clerk organization
  const currentTenant: Tenant | null = useMemo(() => {
    if (!clerkUser) return null;
    
    // If user has an active Clerk organization, use that
    if (activeOrg) {
      // Check user's role in the organization
      const membership = userMemberships?.data?.find(
        m => m.organization.id === activeOrg.id
      );
      const role = membership?.role === 'org:admin' ? 'Admin' : 'Mitglied';
      
      return {
        id: activeOrg.id,
        name: activeOrg.name,
        slug: activeOrg.slug || activeOrg.id,
        type: 'organization',
        role,
        imageUrl: activeOrg.imageUrl,
      };
    }
    
    // No active org - show personal account
    return {
      id: clerkUser.id,
      name: 'Persönlicher Bereich',
      slug: 'personal',
      type: 'personal',
      role: 'Besitzer',
    };
  }, [clerkUser, activeOrg, userMemberships?.data]);

  // Build tenant list from Clerk organizations
  const tenants: Tenant[] = useMemo(() => {
    const tenantList: Tenant[] = [];
    
    // Always add personal space option
    if (clerkUser) {
      tenantList.push({
        id: clerkUser.id,
        name: 'Persönlicher Bereich',
        slug: 'personal',
        type: 'personal',
        role: 'Besitzer',
      });
    }
    
    // Add Clerk organizations the user is a member of
    if (membershipsLoaded && userMemberships?.data) {
      for (const membership of userMemberships.data) {
        const org = membership.organization;
        if (org) {
          tenantList.push({
            id: org.id,
            name: org.name,
            slug: org.slug || org.id,
            type: 'organization',
            role: membership.role === 'org:admin' ? 'Admin' : 'Mitglied',
            imageUrl: org.imageUrl,
          });
        }
      }
    }
    
    return tenantList;
  }, [clerkUser, membershipsLoaded, userMemberships?.data]);

  // Handle tenant switching
  const handleTenantChange = useCallback(async (tenant: Tenant) => {
    console.log('Switching to tenant:', tenant.id, tenant.name);
    
    // If switching to personal space
    if (tenant.type === 'personal') {
      if (setActive) {
        await setActive({ organization: null });
      }
      return;
    }
    
    // If switching to a Clerk organization
    if (setActive && tenant.type === 'organization') {
      await setActive({ organization: tenant.id });
    }
  }, [setActive]);

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

  // Show loading state
  const isLoading = !userLoaded || !membershipsLoaded;

  // accounts.mojo shows all available apps (no entitlements filtering)
  const entitlements: string[] = [];

  return (
    <MojoTopbar
      currentApp="account"
      user={mojoUser}
      tenant={currentTenant}
      tenants={tenants}
      entitlements={entitlements}
      onTenantChange={handleTenantChange}
      onLogout={handleLogout}
      isLoading={isLoading}
    />
  );
}
