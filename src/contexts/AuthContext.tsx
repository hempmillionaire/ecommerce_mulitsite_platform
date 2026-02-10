import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { CustomAuthService, type CustomAuthUser } from '../lib/custom-auth';
import type { UserRole } from '../lib/database.types';

const USE_CUSTOM_AUTH = true;
const SESSION_TOKEN_KEY = 'commerce_os_session_token';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  company_id: string | null;
  assigned_sales_rep_id: string | null;
}

interface AuthContextType {
  user: User | CustomAuthUser | null;
  profile: UserProfile | null;
  session: Session | string | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  isAdmin: boolean;
  isVendor: boolean;
  isSalesRep: boolean;
  isB2BApproved: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | CustomAuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_CUSTOM_AUTH) {
      initializeCustomAuth();
    } else {
      initializeSupabaseAuth();
    }
  }, []);

  const initializeCustomAuth = async () => {
    try {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }

      const validatedUser = await CustomAuthService.validateSession(token);
      if (!validatedUser) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setLoading(false);
        return;
      }

      setUser(validatedUser);
      setSession(token);
      await loadUserProfileFromCustomAuth(validatedUser.id);
    } catch (error) {
      console.error('Error initializing custom auth:', error);
      setLoading(false);
    }
  };

  const initializeSupabaseAuth = () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (() => {
        (async () => {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await loadUserProfile(session.user.id);
          } else {
            setProfile(null);
            setLoading(false);
          }
        })();
      })();
    });

    return () => subscription.unsubscribe();
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfileFromCustomAuth = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      if (USE_CUSTOM_AUTH) {
        const result = await CustomAuthService.signup({
          email,
          password,
          fullName,
        });

        if (!result) {
          throw new Error('Signup failed');
        }

        localStorage.setItem(SESSION_TOKEN_KEY, result.session.token);
        setUser(result.user);
        setSession(result.session.token);
        await loadUserProfileFromCustomAuth(result.user.id);

        return { error: null };
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              id: data.user.id,
              email: data.user.email!,
              full_name: fullName || null,
              role: 'retail',
            });

          if (profileError) throw profileError;
        }

        return { error: null };
      }
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      if (USE_CUSTOM_AUTH) {
        const result = await CustomAuthService.login({ email, password });

        if (!result) {
          throw new Error('Invalid credentials');
        }

        localStorage.setItem(SESSION_TOKEN_KEY, result.session.token);
        setUser(result.user);
        setSession(result.session.token);
        await loadUserProfileFromCustomAuth(result.user.id);

        return { error: null };
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        return { error: null };
      }
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      if (USE_CUSTOM_AUTH) {
        const token = localStorage.getItem(SESSION_TOKEN_KEY);
        if (token) {
          await CustomAuthService.logout(token);
          localStorage.removeItem(SESSION_TOKEN_KEY);
        }
        setUser(null);
        setProfile(null);
        setSession(null);
        return { error: null };
      } else {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { error: null };
      }
    } catch (error) {
      return { error: error as Error };
    }
  };

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!profile) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(profile.role);
  };

  const isAdmin = profile?.role === 'admin';
  const isVendor = profile?.role === 'vendor';
  const isSalesRep = profile?.role === 'sales_rep';
  const isB2BApproved = profile?.role === 'b2b_approved';

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    hasRole,
    isAdmin,
    isVendor,
    isSalesRep,
    isB2BApproved,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
