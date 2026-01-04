'use client';

import { SignUp } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { useAuth } from '@clerk/nextjs';

/**
 * Sign-Up Page für accounts.mojo
 * 
 * Verwendet hash-basiertes Routing für Clerk Multi-Step-Auth
 */
function SignUpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  // Client-Side Fallback Redirect
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const redirectUrl = searchParams.get('redirect_url') || '/';
      router.replace(redirectUrl);
    }
  }, [isLoaded, isSignedIn, router, searchParams]);

  // Wenn bereits eingeloggt, zeige Loading
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

  const redirectUrl = searchParams.get('redirect_url') || '/';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp
        routing="hash"
        signInUrl="/sign-in"
        fallbackRedirectUrl={redirectUrl}
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

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4">Laden...</div>
        </div>
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}

