'use client';

import { SignIn } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

/**
 * Sign-In Page für accounts.mojo
 * 
 * Implementiert gemäß platform.mojo CODING_STANDARDS.md Section 3.6:
 * - Standard Clerk <SignIn /> Komponente
 * - Redirect-Logik mit Query-Parameter-Support
 * - Client-Side Fallback für Redirects (wenn Middleware nicht greift)
 */
export default function SignInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  // Client-Side Fallback Redirect (wenn Middleware nicht greift)
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const redirectUrl = searchParams.get('redirect_url') || '/';
      router.replace(redirectUrl);
    }
  }, [isLoaded, isSignedIn, router, searchParams]);

  // Wenn bereits eingeloggt, zeige Loading (Middleware sollte redirecten)
  if (isLoaded && isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4">Weiterleitung...</div>
          <div className="text-sm text-muted-foreground">Du wirst weitergeleitet...</div>
        </div>
      </div>
    );
  }

  // Redirect URL aus Query-Parameter oder Standard-Route
  const redirectUrl = searchParams.get('redirect_url') || '/';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl={redirectUrl}
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-lg',
          },
        }}
      />
    </div>
  );
}

