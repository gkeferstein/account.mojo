/**
 * Clerk Middleware for accounts.mojo
 * 
 * Auth Strategy:
 * - All page routes are public (DashboardLayout handles client-side auth UI)
 * - API routes are protected except webhooks and health
 * - SignedIn/SignedOut components in DashboardLayout control the UI
 * 
 * @see https://clerk.com/docs/references/nextjs/clerk-middleware
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that require authentication
const isProtectedApiRoute = createRouteMatcher([
  '/api/me(.*)',
  '/api/tenants(.*)',
  '/api/billing(.*)',
  '/api/preferences(.*)',
]);

// Routes that should always be public
const isPublicRoute = createRouteMatcher([
  '/api/webhooks(.*)',
  '/api/health(.*)',
  '/health(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Always allow public routes
  if (isPublicRoute(req)) {
    return;
  }
  
  // Protect specific API routes
  if (isProtectedApiRoute(req)) {
    await auth.protect();
  }
  
  // All other routes (pages) are public - DashboardLayout handles auth UI
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
