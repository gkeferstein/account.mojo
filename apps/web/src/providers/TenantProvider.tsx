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
  platformRole: 'platform_admin' | 'platform_support' | 'platform_finance' | 'platform_content_admin' | null;
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
  // Only use useOrganizationList when user is signed in to avoid Clerk warning
  const orgList = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const setActive = orgList?.setActive;
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

      // Wait a bit for Clerk to fully initialize the session
      // This helps avoid race conditions where the token isn't ready yet
      if (!hasInitialized) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Use cached token for normal navigation, fresh token only when needed
      // Always skip cache on initial load to ensure we have a valid token
      let token = await getToken({ skipCache: skipCache || !hasInitialized });
      
      // DEBUG: Log token info (only in development and only on initial load)
      if (process.env.NODE_ENV === 'development' && !hasInitialized) {
        console.log("[TenantProvider] DEBUG token info:", {
          hasToken: !!token,
          tokenLength: token?.length || 0,
          tokenPrefix: token?.substring(0, 50) || 'none',
          isSignedIn,
          hasInitialized,
        });
      }
      
      if (!token) {
        // Retry once with fresh token if initial load
        if (!hasInitialized) {
          await new Promise(resolve => setTimeout(resolve, 300));
          token = await getToken({ skipCache: true });
        }
        
        if (!token) {
          console.warn("[TenantProvider] No token available, user may not be authenticated");
          setUser(null);
          setTenants([]);
          setActiveTenant(null);
          setIsInitialLoading(false);
          setHasInitialized(true);
          return;
        }
      }

      // Get stored tenant ID to pass to API (fallback if JWT doesn't have org_id)
      const storedTenantId = getStoredTenantId();
      
      // Fetch session with optional active tenant override
      // Retry once if we get 401 on initial load (token might not be ready yet)
      let session;
      try {
        session = await accountsApi.getMe(token, storedTenantId);
      } catch (err: any) {
        // If 401 on initial load, retry once with fresh token
        if (!hasInitialized && (err.statusCode === 401 || err.message?.includes('401'))) {
          console.warn("[TenantProvider] Got 401 on initial load, retrying with fresh token...");
          
          // Wait a bit longer and check if user is still signed in
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Double-check that user is still signed in before retrying
          if (!isSignedIn) {
            console.warn("[TenantProvider] User no longer signed in, aborting retry");
            throw err;
          }
          
          const freshToken = await getToken({ skipCache: true });
          if (freshToken) {
            try {
              session = await accountsApi.getMe(freshToken, storedTenantId);
            } catch (retryErr: any) {
              // If retry also fails with 401, user might not be authenticated yet
              // This is normal on initial page load - just log and let error handling deal with it
              console.warn("[TenantProvider] Retry also failed with 401, user may not be fully authenticated yet");
              throw retryErr;
            }
          } else {
            console.warn("[TenantProvider] No fresh token available for retry");
            throw err; // Re-throw if we still don't have a token
          }
        } else {
          throw err; // Re-throw if not initial load or not 401
        }
      }

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
        (err.message.includes('401') || 
         err.message.includes('Unauthorized') || 
         err.message.includes('Invalid token') ||
         (err as any).statusCode === 401);
      
      if (!isUnauthorized) {
        console.error("Failed to fetch session:", err);
        setError(err instanceof Error ? err.message : "Failed to load session");
      } else {
        // 401 means user is not authenticated or token is invalid
        // On initial load, this might be normal if Clerk hasn't fully initialized yet
        // Don't clear state immediately - wait a bit and let Clerk finish initializing
        if (!hasInitialized) {
          console.warn("[TenantProvider] Unauthorized on initial load - this might be normal, will retry on next auth state change");
          // Don't mark as initialized yet - let the useEffect retry when auth state changes
          setIsInitialLoading(false);
          // Don't set hasInitialized to true, so useEffect can retry
          return;
        }
        
        // For subsequent requests, clear state
        console.warn("[TenantProvider] Unauthorized - clearing session state");
        setUser(null);
        setTenants([]);
        setActiveTenant(null);
        setError(null);
        storeTenantId(null);
        setIsInitialLoading(false);
        setHasInitialized(true);
      }
    } finally {
      setIsInitialLoading(false);
      setHasInitialized(true);
    }
  }, [isSignedIn, getToken, hasInitialized]);

  // Only fetch on initial mount or when auth state changes
  useEffect(() => {
    // Wait for Clerk to be fully loaded AND user to be signed in before fetching
    if (isLoaded && isSignedIn && !hasInitialized) {
      fetchSession(false, true); // Initial load with loading state
    } else if (isLoaded && !isSignedIn && !hasInitialized) {
      // User is not signed in, mark as initialized
      setIsInitialLoading(false);
      setHasInitialized(true);
    }
  }, [isLoaded, isSignedIn, hasInitialized, fetchSession]);

  const switchTenant = useCallback(async (tenantId: string) => {
    if (!isSignedIn) return;

    // Store previous state for rollback
    const previousTenant = activeTenant;
    const previousTenantId = getStoredTenantId();

    try {
      const newActiveTenant = tenants.find((t) => t.id === tenantId);
      if (!newActiveTenant) {
        throw new Error("Tenant not found");
      }

      // Debug: Log switch attempt (only in development)
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

      // Set active organization in Clerk (with error handling)
      // This will update the JWT to include org_id for future requests
      // Note: Clerk errors are non-critical if the tenant exists in our database
      let clerkUpdateSuccess = true;
      try {
        if (setActive) {
          if (!newActiveTenant.isPersonal && newActiveTenant.clerkOrgId) {
            await setActive({ organization: newActiveTenant.clerkOrgId });
          } else if (newActiveTenant.isPersonal) {
            await setActive({ organization: null });
          }
        }
        // Small delay to let Clerk update
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (clerkError: any) {
        clerkUpdateSuccess = false;
        
        // Only log in development, don't spam console in production
        if (process.env.NODE_ENV === 'development') {
          console.warn("[TenantProvider] Clerk setActive failed (non-critical):", clerkError);
        }
        
        // Check if this is a critical error that should prevent the switch
        const errorMessage = clerkError?.message || String(clerkError);
        const isCriticalError = errorMessage.includes('not found') || 
                               errorMessage.includes('permission') ||
                               errorMessage.includes('Forbidden') ||
                               errorMessage.includes('403') ||
                               errorMessage.includes('404');
        
        // Only rollback if it's a critical error AND we don't have a valid clerkOrgId
        // If the tenant exists in our DB but not in Clerk, we can still proceed
        // (this might happen for platform orgs or special tenants)
        if (isCriticalError && !newActiveTenant.clerkOrgId && !newActiveTenant.isPersonal) {
          // Rollback optimistic update only if we can't proceed
          if (previousTenant) {
            storeTenantId(previousTenant.id);
            setActiveTenant(previousTenant);
          } else if (previousTenantId) {
            storeTenantId(previousTenantId);
          } else {
            storeTenantId(null);
            setActiveTenant(null);
          }
          
          throw new Error(
            `Organisation nicht gefunden oder keine Berechtigung. ` +
            `Bitte stelle sicher, dass die Organisation in Clerk existiert und du Zugriff hast.`
          );
        }
        // For other errors or if we have a valid tenant in our DB, continue
        // The API call will validate access, and if that succeeds, we're good
      }

      // Call API to switch tenant (with error handling)
      // This is the authoritative check - if API succeeds, the switch is valid
      try {
        const token = await getToken({ skipCache: false }); // Use cached token for speed
        if (token) {
          await accountsApi.switchTenant(token, tenantId);
        }
      } catch (apiError: any) {
        // API error is critical - rollback
        if (process.env.NODE_ENV === 'development') {
          console.warn("[TenantProvider] API switchTenant failed:", apiError);
        }
        
        // Rollback optimistic update
        if (previousTenant) {
          storeTenantId(previousTenant.id);
          setActiveTenant(previousTenant);
        } else if (previousTenantId) {
          storeTenantId(previousTenantId);
        } else {
          storeTenantId(null);
          setActiveTenant(null);
        }
        
        // If Clerk also failed, provide a more helpful error message
        if (!clerkUpdateSuccess) {
          throw new Error(
            `Tenant-Wechsel fehlgeschlagen: Die Organisation existiert möglicherweise nicht in Clerk oder du hast keinen Zugriff. ` +
            `Bitte kontaktiere den Support, falls das Problem weiterhin besteht.`
          );
        }
        
        throw apiError;
      }

      // Refresh session in background with fresh token (don't show loading)
      // This will sync any inconsistencies
      fetchSession(true, false).catch(err => {
        console.error("[TenantProvider] Background refresh failed after switch:", err);
        // If refresh fails, try to restore previous state
        if (previousTenant) {
          storeTenantId(previousTenant.id);
          setActiveTenant(previousTenant);
        }
      });
    } catch (err) {
      // Only log errors in development to reduce console noise
      if (process.env.NODE_ENV === 'development') {
        console.error("[TenantProvider] Failed to switch tenant:", err);
      }
      
      // Ensure we refresh session to get back to valid state
      fetchSession(true, false).catch(refreshErr => {
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.error("[TenantProvider] Failed to refresh session after error:", refreshErr);
        }
      });
      
      throw err;
    }
  }, [isSignedIn, getToken, tenants, setActive, fetchSession, activeTenant]);

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
