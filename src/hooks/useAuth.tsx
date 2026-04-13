import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Profile, Plan } from "@/types/database";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  plan: Plan | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  plan: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError || !profileData) {
        console.warn("Failed to fetch profile:", profileError?.message);
        return;
      }

      setProfile(profileData);

      // Check if trial has expired
      const trialExpired = profileData.trial_ends_at
        ? new Date(profileData.trial_ends_at) < new Date()
        : false;

      // If trial expired, use original (freemium) plan; otherwise use current plan
      const planIdToUse = trialExpired && profileData.original_plan_id
        ? profileData.original_plan_id
        : profileData.current_plan_id;

      const { data: planData, error: planError } = await supabase
        .from("plans")
        .select("*")
        .eq("id", planIdToUse)
        .single();
      
      if (planError) {
        console.warn("Failed to fetch plan:", planError.message);
      }
      if (planData) setPlan(planData);

      // If trial expired and profile still shows standard, revert in DB
      if (trialExpired && profileData.original_plan_id && profileData.current_plan_id !== profileData.original_plan_id) {
        await supabase
          .from("profiles")
          .update({ current_plan_id: profileData.original_plan_id, trial_ends_at: null })
          .eq("id", userId);
      }
    } catch (err) {
      console.warn("fetchProfile unexpected error:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Set up listener FIRST (before getSession) so no events are missed
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // For sign-in events, give session time to fully propagate
          const delay = event === "SIGNED_IN" ? 1000 : 500;
          setTimeout(() => fetchProfile(session.user.id), delay);
        } else {
          setProfile(null);
          setPlan(null);
        }
        setLoading(false);
      }
    );

    // Then restore session from storage
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Stale/invalid refresh token — clear state gracefully
        console.warn("Session restore failed, signing out:", error.message);
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        setPlan(null);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setPlan(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, plan, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
