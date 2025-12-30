'use client';

/**
 * Dashboard Layout Component
 * Uses MOJO Design System MojoShell for consistent layout across all pages
 * Modeled after payments.mojo implementation
 * 
 * Manages the sidebar collapsed state centrally to keep
 * MojoShell and MojoSidebar in sync.
 */

import { ReactNode, useState, useCallback } from 'react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { MojoShell, MojoBackground } from '@gkeferstein/design';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useTenant } from '@/providers/TenantProvider';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardLayoutProps {
  children: ReactNode;
}

// LocalStorage key for sidebar state persistence
const SIDEBAR_COLLAPSED_KEY = 'mojo-sidebar-collapsed';

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isLoading } = useTenant();
  
  // Initialize from localStorage if available
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return saved === 'true';
    }
    return false;
  });

  // Toggle sidebar and persist to localStorage
  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const newValue = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
      }
      return newValue;
    });
  }, []);

  return (
    <>
      <SignedOut>
        <MojoBackground noise orbs>
          <div className="min-h-screen flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-4xl font-bold mb-4 gradient-text">
                MOJO Accounts
              </h1>
              <p className="text-muted-foreground mb-8 max-w-md">
                Verwalte dein MOJO Konto, Abonnements und Team-Mitgliedschaften an einem Ort.
              </p>
              <SignInButton mode="modal">
                <Button size="lg" className="gap-2">
                  Anmelden
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </SignInButton>
            </motion.div>
          </div>
        </MojoBackground>
      </SignedOut>

      <SignedIn>
        {isLoading ? (
          <MojoBackground noise orbs>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="inline-block">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="mt-4 text-muted-foreground">Laden...</p>
              </div>
            </div>
          </MojoBackground>
        ) : (
          <MojoShell
            sidebar={
              <Sidebar
                collapsed={sidebarCollapsed}
                onToggleCollapse={handleToggleSidebar}
              />
            }
            topbar={<Header />}
            showBackground
            noise
            orbs
            sidebarCollapsed={sidebarCollapsed}
            className="p-6"
          >
            {children}
          </MojoShell>
        )}
      </SignedIn>
    </>
  );
}
