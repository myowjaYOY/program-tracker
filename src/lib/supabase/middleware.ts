import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next();
  // Create Supabase client for potential session management
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

  return response;
}
