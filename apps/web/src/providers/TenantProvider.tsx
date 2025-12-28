"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { accountsApi } from "@/lib/api";

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
}

interface TenantContextType {
  user: User | null;
  tenants: Tenant[];
  activeTenant: Tenant | null;
  isLoading: boolean;
  error: string | null;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!isSignedIn) {
      setUser(null);
      setTenants([]);
      setActiveTenant(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error("No token available");
      }

      const session = await accountsApi.getMe(token);

      setUser(session.user);
      setTenants(session.tenants);
      setActiveTenant(session.activeTenant);
    } catch (err) {
      console.error("Failed to fetch session:", err);
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isLoaded) {
      fetchSession();
    }
  }, [isLoaded, isSignedIn, fetchSession]);

  const switchTenant = useCallback(async (tenantId: string) => {
    if (!isSignedIn) return;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No token available");
      }

      await accountsApi.switchTenant(token, tenantId);

      const newActiveTenant = tenants.find((t) => t.id === tenantId);
      if (newActiveTenant) {
        setActiveTenant(newActiveTenant);
      }
    } catch (err) {
      console.error("Failed to switch tenant:", err);
      throw err;
    }
  }, [isSignedIn, getToken, tenants]);

  const refreshSession = useCallback(async () => {
    await fetchSession();
  }, [fetchSession]);

  return (
    <TenantContext.Provider
      value={{
        user,
        tenants,
        activeTenant,
        isLoading,
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

