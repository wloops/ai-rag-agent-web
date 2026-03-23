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
import { useRouter } from "next/navigation";

import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/auth-storage";
import { AUTH_UNAUTHORIZED_EVENT, authApi } from "@/lib/api";
import type { AuthSession, LoginRequest, RegisterRequest, User } from "@/lib/types";

interface AuthContextValue {
  session: AuthSession | null;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<User>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: (redirectTo?: string) => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncSession = useCallback((token: string, user: User) => {
    setStoredToken(token);
    setSession({ token, user });
  }, []);

  const clearSession = useCallback(() => {
    clearStoredToken();
    setSession(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = session?.token ?? getStoredToken();
    if (!token) {
      clearSession();
      return null;
    }

    try {
      const user = await authApi.me(token);
      syncSession(token, user);
      return user;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession, session?.token, syncSession]);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const response = await authApi.login(payload);
      const user = await authApi.me(response.access_token);
      syncSession(response.access_token, user);
      return user;
    },
    [syncSession],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      await authApi.register(payload);
      return login({ email: payload.email, password: payload.password });
    },
    [login],
  );

  const logout = useCallback(
    (redirectTo = "/login") => {
      clearSession();
      router.replace(redirectTo);
    },
    [clearSession, router],
  );

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const token = getStoredToken();
      if (!token) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const user = await authApi.me(token);
        if (isMounted) {
          syncSession(token, user);
        }
      } catch {
        if (isMounted) {
          clearSession();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [clearSession, syncSession]);

  useEffect(() => {
    function handleUnauthorized() {
      clearSession();
      router.replace("/login");
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [clearSession, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      token: session?.token ?? null,
      isLoading,
      isAuthenticated: Boolean(session),
      login,
      register,
      logout,
      refreshUser,
    }),
    [isLoading, login, logout, refreshUser, register, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
