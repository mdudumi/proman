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
  // { userId, status: "ready" | "inactive" | "error", profile }
  const [profileResult, setProfileResult] = useState(null);
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
    const userId = session?.user?.id;
    if (!userId) return;

    let mounted = true;

    supabase
      .from("proman_users")
      .select("user_id, email, role, is_active")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          console.warn("Profile fetch failed:", error);
          // A failed re-check (e.g. on token refresh) keeps an already loaded profile.
          setProfileResult(prev =>
            prev?.userId === userId && prev.status === "ready"
              ? prev
              : { userId, status: "error", profile: null }
          );
          return;
        }

        // No proman_users row, or is_active = false
        if (!data?.is_active) {
          setProfileResult({ userId, status: "inactive", profile: null });
          return;
        }

        setProfileResult({ userId, status: "ready", profile: data });
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  // Until the current user's result arrives, the profile is "loading".
  const userId = session?.user?.id;
  const current = userId && profileResult?.userId === userId ? profileResult : null;
  const profile = current?.profile ?? null;
  const profileStatus = current?.status ?? "loading";

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      profileStatus,
      loading,
    }),
    [session, profile, profileStatus, loading]
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
