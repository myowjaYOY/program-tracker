import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // Get the pathname of the request
  const { pathname } = request.nextUrl;

  // Get the user from the request headers (set by updateSession)
  const user = request.headers.get('x-user');

  // Auth routes that should redirect to dashboard if user is authenticated
  const authRoutes = ['/login', '/register', '/forgot-password'];

  // Protected routes that should redirect to login if user is not authenticated
  const protectedRoutes = ['/dashboard', '/campaigns', '/leads'];

  // If user is authenticated and trying to access auth routes, redirect to dashboard
  if (user && authRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If user is not authenticated and trying to access protected routes, redirect to login
  if (!user && protectedRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
