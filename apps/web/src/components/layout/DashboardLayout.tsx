'use client';

/**
 * Dashboard Layout Component
 * Uses MOJO Design System MojoShell for consistent layout across all pages
 */

import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { MojoShell, MojoBackground } from '@mojo/design';
import { Header } from './Header';
import { Sidebar } from '../Sidebar';
import { useTenant } from '@/providers/TenantProvider';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Wrapper to handle React 18/19 type mismatch with @mojo/design
function ShellWrapper({ children }: { children: React.ReactNode }) {
  // Cast children to any to avoid React 18/19 ReactNode type mismatch
  const content = children as any;
  return (
    <MojoShell
      sidebar={<Sidebar />}
      topbar={<Header />}
      showBackground
      noise
      orbs
      className="p-6"
    >
      {content}
    </MojoShell>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isLoading } = useTenant();

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
          <ShellWrapper>{children}</ShellWrapper>
        )}
      </SignedIn>
    </>
  );
}
