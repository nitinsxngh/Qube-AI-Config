"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  AuthUser,
  clearAuthSession,
  getAccessToken,
  getStoredUser,
  setAuthSession,
} from "@/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refreshMe = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await api.authMe();
      setUser(me);
      setAuthSession(token, me);
    } catch {
      clearAuthSession();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setLoading(true);
      const stored = getStoredUser();
      if (stored && getAccessToken()) {
        if (!cancelled) setUser(stored);
      }
      await refreshMe();
      if (!cancelled) setLoading(false);
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  useEffect(() => {
    if (loading) return;
    const isLogin = pathname === "/login";
    if (!user && !isLogin) {
      const next = pathname && pathname !== "/" ? pathname : "/rag";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
    if (user && isLogin) {
      router.replace("/rag");
    }
  }, [loading, user, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setAuthSession(result.access_token, result.user);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshMe }),
    [user, loading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[14px] text-[#86868b]">Loading…</p>
      </div>
    );
  }

  if (!user && !isLogin) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[14px] text-[#86868b]">Redirecting to login…</p>
      </div>
    );
  }

  return <>{children}</>;
}
