import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ─── Route definitions ───────────────────────────────────────────────────────

const PUBLIC_ROUTES = ['/api/health', '/api/webhooks'];
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];
const PROTECTED_PREFIXES = ['/dashboard', '/members', '/programs', '/surveys', '/reports', '/admin', '/settings', '/campaigns', '/leads'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractTenantSlug(request: NextRequest): string | null {
  const hostname = request.headers.get('host') || '';
  const hostWithoutPort = hostname.split(':')[0] ?? '';
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost';

  if (!hostWithoutPort.endsWith(baseDomain)) return null;

  const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '');
  if (!subdomain || subdomain === 'www' || subdomain === hostWithoutPort) return null;

  return subdomain;
}

function getAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => '', set: () => { }, remove: () => { } } }
  );
}

function loginRedirect(request: NextRequest, params?: string) {
  const host = request.headers.get('host') || '';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const qs = params ? `?${params}` : '';
  return NextResponse.redirect(`${protocol}://${host}/login${qs}`);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip public/static routes entirely
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const isRoot = pathname === '/';
  const isAuthRoute = isRoot || AUTH_ROUTES.some(r => pathname.startsWith(r));
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));

  // If route is neither auth nor protected, pass through
  if (!isAuthRoute && !isProtected) {
    return NextResponse.next();
  }

  // 2. Create Supabase client and check auth
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
  const { data: { user } } = await supabase.auth.getUser();

  // 3. Validate tenant subdomain (applies to ALL routes when subdomain is present)
  const tenantSlug = extractTenantSlug(request);

  if (tenantSlug) {
    const admin = getAdminClient();
    const { data: tenant } = await admin
      .from('tenants')
      .select('is_active')
      .eq('tenant_slug', tenantSlug)
      .single();

    // For protected routes, block unknown/inactive tenants at the middleware level
    if (isProtected) {
      if (!tenant) {
        const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost';
        const portMatch = (request.headers.get('host') || '').match(/:\d+$/);
        const port = portMatch ? portMatch[0] : '';
        return NextResponse.redirect(`http://${baseDomain}${port}/login`);
      }
      if (!tenant.is_active) {
        return loginRedirect(request, 'error=tenant_deactivated');
      }
    }

    // For auth routes (login/register), let the request pass through
    // AuthLayout will show "Organization Not Found" or "Tenant Deactivated"
  }

  // 4. Root path → dashboard or login
  if (isRoot) {
    return user
      ? NextResponse.redirect(new URL('/dashboard', request.url))
      : NextResponse.redirect(new URL('/login', request.url));
  }

  // 5. Already-authenticated user on auth pages → dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 6. Unauthenticated user on protected pages → login (preserving subdomain)
  if (!user && isProtected) {
    return loginRedirect(request, `redirect=${encodeURIComponent(pathname)}`);
  }

  // 7. Tenant user authorization (authenticated + protected + subdomain)
  if (user && tenantSlug && isProtected) {
    let userSlug = user.user_metadata?.tenant_slug;
    let authorized = userSlug === tenantSlug;

    if (!authorized) {
      const admin = getAdminClient();
      const { data: userData } = await admin
        .from('users')
        .select('is_super_admin, tenants(tenant_slug)')
        .eq('id', user.id)
        .single();

      if (userData?.is_super_admin) {
        authorized = true;
      } else if (userData?.tenants && !Array.isArray(userData.tenants)) {
        userSlug = (userData.tenants as any).tenant_slug;
        authorized = userSlug === tenantSlug;
      }
    }

    if (!authorized) {
      if (userSlug) {
        const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost';
        const portMatch = (request.headers.get('host') || '').match(/:\d+$/);
        const port = portMatch ? portMatch[0] : '';
        return NextResponse.redirect(`http://${userSlug}.${baseDomain}${port}/dashboard`);
      }
      return loginRedirect(request, 'error=unauthorized_tenant');
    }

    response.headers.set('x-tenant-slug', tenantSlug);
  }

  if (user) {
    response.headers.set('x-user-id', user.id);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};