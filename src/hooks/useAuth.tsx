import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  unique_id: string;
  role: 'faculty' | 'student';
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: Error | null }>;
  signUp: (data: {
    email: string;
    password: string;
    name: string;
    uniqueId: string;
    role: 'faculty' | 'student';
  }) => Promise<{ error?: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: Error | null }>;
  fetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = useCallback(async (retryCount = 0) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error: unknown) {
      console.error('Error fetching profile:', error);
      
      // Retry logic for network errors
      if (retryCount < 3 && (error as any)?.message?.includes('Failed to fetch')) {
        console.log(`Retrying profile fetch... (attempt ${retryCount + 1}/3)`);
        setTimeout(() => {
          fetchProfile(retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      }
    }
  }, [user]);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user && event === 'SIGNED_IN') {
          // Fetch profile after sign in
          setTimeout(() => {
            fetchProfile();
          }, 0);
        } else if (!session) {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          fetchProfile();
        }, 0);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array is intentional for auth listener

  // Refetch profile when user changes
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user ID, not the fetchProfile function

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          return { error: { message: 'Please check your email and click the confirmation link before signing in.' } };
        }
        return { error: { message: error.message || 'Invalid credentials. Please check your email and password.' } };
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (data: {
    email: string;
    password: string;
    name: string;
    uniqueId: string;
    role: 'faculty' | 'student';
  }) => {
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
          data: {
            name: data.name,
            unique_id: data.uniqueId,
            role: data.role,
          },
        },
      });

      if (error) {
        return { error };
      }

      // Check if user needs to confirm email
      if (signUpData.user && !signUpData.user.email_confirmed_at) {
        // Sign out user to force verification flow
        await supabase.auth.signOut();
        
        // Clear any cached session data
        setSession(null);
        setUser(null);
        setProfile(null);
        
        return { error: null, data: signUpData, needsConfirmation: true };
      }

      return { error: null, data: signUpData, needsConfirmation: false };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Clear local state first
      setProfile(null);
      setUser(null);
      setSession(null);
      
      // Clear any auth-related items from localStorage
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('sb-ivqqhhcfoyzmvwzwwxoe-auth-token');
      
      // Check if there's an active session before attempting to sign out
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        // Only attempt to sign out if there's an active session
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          console.error('Supabase sign out error:', error);
          // Only show error if it's not about missing session
          if (!error.message.toLowerCase().includes('session')) {
            toast({
              title: "Error signing out",
              description: error.message,
              variant: "destructive",
            });
          }
        }
      }
      
      // Force a page reload to clear any cached state
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    } catch (error) {
      // Handle any unexpected errors
      console.error('Sign out error:', error);
      
      // Clear local state even if sign out fails
      setProfile(null);
      setUser(null);
      setSession(null);
      
      // Clear localStorage as backup
      localStorage.clear();
      
      // Force redirect to login
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log("🔥 [Auth] Starting password reset for:", email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password-complete`,
      });

      if (error) {
        console.error("❌ [Auth] Password reset error:", error);
        return { error };
      }

      console.log("✅ [Auth] Password reset email sent successfully");
      return { error: null };
    } catch (error) {
      console.error("❌ [Auth] Unexpected password reset error:", error);
      return { error };
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    fetchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};