import { NextResponse } from 'next/server';

/**
 * DISABLED FOR PRODUCTION SECURITY
 * 
 * This endpoint previously allowed any authenticated user to make themselves admin.
 * This is a critical security vulnerability and has been disabled.
 * 
 * Admin privileges should be granted through the database or by existing admins
 * via the /dashboard/admin/users page.
 */
export async function POST() {
  // Block in production - this is a development-only utility
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    );
  }

  // Even in development, return disabled message
  // Admin creation should be done via proper admin tools or database
  return NextResponse.json(
    { 
      error: 'This endpoint is disabled for security reasons. Use the admin panel or database to manage admin users.',
      hint: 'Contact an existing admin or modify the database directly to grant admin privileges.'
    },
    { status: 403 }
  );
}
