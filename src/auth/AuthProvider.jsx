import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1️⃣ Get initial session + listen for changes
  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(data.session ?? null);
      setLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession ?? null);
      }
    );

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // 2️⃣ Load profile AFTER session exists
  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("proman_users")
        .select("user_id, email, role, is_active")
        .eq("user_id", session.user.id)
        .single();

      if (!mounted) return;

      if (error) {
        console.warn("Profile fetch blocked or missing:", error);
        setProfile(null);
        return;
      }

      if (!data.is_active) {
        console.warn("User inactive:", data.email);
        setProfile(null);
        return;
      }

      setProfile(data);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
    }),
    [session, profile, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
