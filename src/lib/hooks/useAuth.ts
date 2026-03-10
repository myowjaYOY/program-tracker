'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * Auth hook for client components.
 * 
 * Fixed issues:
 * 1. Supabase client is now a singleton (won't cause re-renders)
 * 2. useEffect has no dependencies that change on every render
 * 3. Callbacks are memoized to prevent unnecessary re-renders
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Get singleton client - stable reference
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;

    // Get initial user/session
    const getInitialUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!mounted) return;

        if (user) {
          const { data: { session } } = await supabase.auth.getSession();
          setUser(user);
          setSession(session);
        } else {
          setUser(null);
          setSession(null);
        }
      } catch (err) {
        console.error('Error fetching initial user:', err);
        if (mounted) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (newSession) {
        // Use session.user directly for faster UI update
        // The session is already validated by Supabase
        setUser(newSession.user);
        setSession(newSession);
      } else {
        setUser(null);
        setSession(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]); // supabase is now stable (singleton)

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, [supabase]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, [supabase]);

  return {
    user,
    session,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
}