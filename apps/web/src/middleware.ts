/**
 * Clerk Middleware for accounts.mojo
 * 
 * Auth Strategy:
 * - Redirect-Loop Prävention: Eingeloggte User werden von Sign-In/Sign-Up Seiten redirectet
 * - Protected API Routes: Benötigen Authentifizierung
 * - Public Routes: Webhooks, Health Checks, Sign-In/Sign-Up
 * - Pages: DashboardLayout handled client-side auth UI
 * 
 * @see https://clerk.com/docs/references/nextjs/clerk-middleware
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes that require authentication
const isProtectedApiRoute = createRouteMatcher([
  '/api/me(.*)',
  '/api/tenants(.*)',
  '/api/billing(.*)',
  '/api/preferences(.*)',
  '/api/profile(.*)',
  '/api/data(.*)',
  '/api/entitlements(.*)',
]);

// Routes that should always be public
const isPublicRoute = createRouteMatcher([
  '/api/webhooks(.*)',
  '/api/health(.*)',
  '/health(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  const { pathname } = request.nextUrl;

  // Always allow public routes
  if (isPublicRoute(request)) {
    return;
  }

  // Redirect-Loop Prävention: Eingeloggte User von Sign-In/Sign-Up Seiten redirecten
  if (userId && pathname.startsWith('/sign-in')) {
    const redirectUrl = request.nextUrl.searchParams.get('redirect_url') || '/';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  if (userId && pathname.startsWith('/sign-up')) {
    const redirectUrl = request.nextUrl.searchParams.get('redirect_url') || '/';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // Protect specific API routes
  if (isProtectedApiRoute(request)) {
    await auth.protect();
  }

  // Protect all other routes (pages) - require authentication
  // Nicht eingeloggte Benutzer werden automatisch zu /sign-in weitergeleitet
  if (!userId) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
