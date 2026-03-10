import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Optimized middleware with consolidated auth logic.
 * 
 * Key improvements:
 * 1. Fast-path for static assets and public routes (no auth check)
 * 2. Single auth check that's reused for all decisions
 * 3. Root route handled here to avoid double-redirect
 * 4. Tenant identification preserved
 */

// Routes that don't need any auth check
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/webhooks',
];

// Auth pages - redirect to dashboard if already logged in
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

// Protected routes - redirect to login if not authenticated
const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/members',
  '/programs',
  '/surveys',
  '/reports',
  '/admin',
  '/settings',
  '/campaigns',
  '/leads',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ===== FAST PATH: Skip auth for truly public routes =====
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // ===== FAST PATH: Root route - redirect immediately =====
  // This avoids the slow auth check for the most common entry point
  // Users will be redirected again from /login -> /dashboard if authenticated
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ===== Determine if we need auth check =====
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route));
  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix));
  const needsAuthCheck = isAuthRoute || isProtectedRoute;

  // If route doesn't need auth, pass through without Supabase call
  if (!needsAuthCheck) {
    return NextResponse.next();
  }

  // ===== Auth check (only when needed) =====
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key: string) => request.cookies.get(key)?.value,
        set: (key: string, value: string, options: any) => {
          response.cookies.set({ name: key, value, ...options });
        },
        remove: (key: string, options: any) => {
          response.cookies.set({ name: key, value: '', ...options });
        },
      },
    }
  );

  // Single auth call - this is the expensive operation
  const { data: { user } } = await supabase.auth.getUser();

  // ===== Routing decisions based on auth state =====

  // Authenticated user trying to access auth pages -> redirect to dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Unauthenticated user trying to access protected routes -> redirect to login
  if (!user && isProtectedRoute) {
    // Optionally preserve the intended destination
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ===== Tenant identification (for authenticated requests) =====
  if (user) {
    response.headers.set('x-user-id', user.id);

    const tenantSlug = extractTenantSlug(request);
    if (tenantSlug) {
      response.headers.set('x-tenant-slug', tenantSlug);
    }
  }

  return response;
}

/**
 * Extract tenant slug from subdomain.
 * Supports: acme.yourapp.com → "acme"
 */
function extractTenantSlug(request: NextRequest): string | null {
  const hostname = request.headers.get('host') || '';
  const hostWithoutPort = hostname.split(':')[0] ?? '';
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost';

  if (!hostWithoutPort.endsWith(baseDomain)) {
    return null;
  }

  const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '');

  if (!subdomain || subdomain === 'www' || subdomain === hostWithoutPort) {
    return null;
  }

  return subdomain;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Static assets (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};