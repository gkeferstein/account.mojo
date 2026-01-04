'use client';

import { SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

/**
 * Sign-Up Page für accounts.mojo
 * 
 * Implementiert gemäß platform.mojo CODING_STANDARDS.md Section 3.6:
 * - Standard Clerk <SignUp /> Komponente
 * - Redirect-Logik mit Query-Parameter-Support
 * - Redirect zum Dashboard nach erfolgreichem Sign-Up
 */
export default function SignUpPage() {
  const searchParams = useSearchParams();

  // Nach Sign-Up zum Dashboard oder angegebene Route
  const redirectUrl = searchParams.get('redirect_url') || '/';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        afterSignUpUrl={redirectUrl}
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

