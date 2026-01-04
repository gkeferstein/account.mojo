"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { accountsApi } from "@/lib/api";

// LocalStorage key for active tenant
const ACTIVE_TENANT_KEY = 'accounts-active-tenant-id';

interface User {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  role: string;
  isPersonal: boolean;
  clerkOrgId: string | null;
}

interface TenantContextType {
  user: User | null;
  tenants: Tenant[];
  activeTenant: Tenant | null;
  isLoading: boolean; // Only true on initial load
  error: string | null;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Helper to get stored tenant ID
function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_TENANT_KEY);
}

// Helper to store tenant ID
function storeTenantId(tenantId: string | null): void {
  if (typeof window === 'undefined') return;
  if (tenantId) {
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  } else {
    localStorage.removeItem(ACTIVE_TENANT_KEY);
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch session - only sets loading state on initial load
  const fetchSession = useCallback(async (skipCache = false, showLoading = false) => {
    if (!isSignedIn) {
      setUser(null);
      setTenants([]);
      setActiveTenant(null);
      setError(null);
      setIsInitialLoading(false);
      setHasInitialized(true);
      storeTenantId(null);
      return;
    }

    try {
      // Only show loading spinner on initial load or explicit refresh
      if (showLoading && !hasInitialized) {
        setIsInitialLoading(true);
      }
      setError(null);

      // Use cached token for normal navigation, fresh token only when needed
      const token = await getToken({ skipCache });
      if (!token) {
        setUser(null);
        setTenants([]);
        setActiveTenant(null);
        setIsInitialLoading(false);
        setHasInitialized(true);
        return;
      }

      // Get stored tenant ID to pass to API (fallback if JWT doesn't have org_id)
      const storedTenantId = getStoredTenantId();
      
      // Fetch session with optional active tenant override
      const session = await accountsApi.getMe(token, storedTenantId);

      setUser(session.user);
      setTenants(session.tenants);
      
      // Use the active tenant from API (which respects the stored tenant ID)
      const active = session.activeTenant;
      setActiveTenant(active);
      
      // Store the active tenant ID
      if (active) {
        storeTenantId(active.id);
      }
    } catch (err) {
      const isUnauthorized = err instanceof Error && 
        (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('Invalid token'));
      
      if (!isUnauthorized) {
        console.error("Failed to fetch session:", err);
        setError(err instanceof Error ? err.message : "Failed to load session");
      } else {
        setUser(null);
        setTenants([]);
        setActiveTenant(null);
        setError(null);
      }
    } finally {
      setIsInitialLoading(false);
      setHasInitialized(true);
    }
  }, [isSignedIn, getToken, hasInitialized]);

  // Only fetch on initial mount or when auth state changes
  useEffect(() => {
    if (isLoaded && !hasInitialized) {
      fetchSession(false, true); // Initial load with loading state
    }
  }, [isLoaded, isSignedIn, hasInitialized, fetchSession]);

  const switchTenant = useCallback(async (tenantId: string) => {
    if (!isSignedIn) return;

    try {
      const newActiveTenant = tenants.find((t) => t.id === tenantId);
      if (!newActiveTenant) {
        throw new Error("Tenant not found");
      }

      // Debug: Log switch attempt
      if (process.env.NODE_ENV === 'development') {
        console.log('[TenantProvider] Switching tenant:', {
          tenantId,
          tenantName: newActiveTenant.name,
          isPersonal: newActiveTenant.isPersonal,
          clerkOrgId: newActiveTenant.clerkOrgId,
        });
      }

      // OPTIMISTIC UPDATE: Update UI immediately for instant feedback
      storeTenantId(tenantId);
      setActiveTenant(newActiveTenant);

      // Set active organization in Clerk (in background)
      // This will update the JWT to include org_id for future requests
      const clerkUpdatePromise = (async () => {
        if (!newActiveTenant.isPersonal && newActiveTenant.clerkOrgId) {
          await setActive({ organization: newActiveTenant.clerkOrgId });
        } else if (newActiveTenant.isPersonal) {
          await setActive({ organization: null });
        }
        // Small delay to let Clerk update
        await new Promise(resolve => setTimeout(resolve, 200));
      })();

      // Call API to switch tenant (don't wait for Clerk)
      const token = await getToken({ skipCache: false }); // Use cached token for speed
      if (token) {
        await accountsApi.switchTenant(token, tenantId);
      }

      // Wait for Clerk update to complete
      await clerkUpdatePromise;

      // Refresh session in background with fresh token (don't show loading)
      fetchSession(true, false).catch(err => {
        console.error("[TenantProvider] Background refresh failed after switch:", err);
      });
    } catch (err) {
      console.error("[TenantProvider] Failed to switch tenant:", err);
      throw err;
    }
  }, [isSignedIn, getToken, tenants, setActive, fetchSession]);

  const refreshSession = useCallback(async () => {
    await fetchSession(true, false); // Refresh with fresh token, no loading state
  }, [fetchSession]);

  return (
    <TenantContext.Provider
      value={{
        user,
        tenants,
        activeTenant,
        isLoading: isInitialLoading, // Only show loading on initial mount
        error,
        switchTenant,
        refreshSession,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

export function useActiveTenant() {
  const { activeTenant, isLoading } = useTenant();
  return { tenant: activeTenant, isLoading };
}

export function useUser() {
  const { user, isLoading } = useTenant();
  return { user, isLoading };
}
