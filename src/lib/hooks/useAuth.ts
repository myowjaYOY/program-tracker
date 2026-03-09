'use client';

import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial user/session
    const getInitialUser = async () => {
      try {
        // getUser() is more secure as it fetches the user from the server
        const { data: { user }, error } = await supabase.auth.getUser();

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
      } finally {
        setLoading(false);
      }
    };

    getInitialUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Even on state change, we can verify with getUser() if we want ultimate security,
        // but session.user is generally acceptable here for UI reactivity.
        // However, to be consistent with the user's request:
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user || session.user);
        setSession(session);
      } else {
        setUser(null);
        setSession(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
}
