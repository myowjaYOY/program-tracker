import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Tenant-aware session middleware.
 * 
 * Responsibilities:
 * 1. Manage Supabase auth session (existing behavior)
 * 2. Extract tenant slug from subdomain (if available)
 * 3. Propagate tenant context via request headers
 * 
 * Tenant identification strategy:
 * - Primary: Subdomain-based (acme.yourapp.com → slug = "acme")
 * - Fallback: User's tenant_id from their profile (login-based)
 * 
 * During the migration period, tenant headers may not be set.
 * The application should handle this gracefully.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next();

  // Create Supabase client for session management
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

  // Get the user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Set user header for middleware authentication checks
  if (user) {
    response.headers.set('x-user', user.id);
  }

  // ===== Tenant Identification =====
  const tenantSlug = extractTenantSlug(request);
  if (tenantSlug) {
    response.headers.set('x-tenant-slug', tenantSlug);
  }

  return response;
}

/**
 * Extract tenant slug from the request hostname.
 * 
 * Supports patterns:
 * - acme.yourapp.com → "acme"
 * - acme.localhost:3000 → "acme" (development)
 * 
 * Returns null if:
 * - No subdomain present (e.g. yourapp.com, localhost:3000)
 * - Subdomain is "www"
 * - Running on a non-custom domain
 */
function extractTenantSlug(request: NextRequest): string | null {
  const hostname = request.headers.get('host') || '';

  // Remove port number for parsing
  const hostWithoutPort = hostname.split(':')[0] ?? '';

  // Get the base domain from env (e.g. "yourapp.com" or "localhost")
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost';

  // Check if we have a subdomain
  if (!hostWithoutPort.endsWith(baseDomain)) {
    return null;
  }

  // Extract the subdomain portion
  const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '');

  // Ignore if no subdomain, or it's "www", or it equals the base domain itself
  if (!subdomain || subdomain === 'www' || subdomain === hostWithoutPort) {
    return null;
  }

  return subdomain;
}