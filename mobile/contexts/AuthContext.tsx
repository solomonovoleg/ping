import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import * as api from "../lib/api";
import type { AuthUser } from "../lib/api";
import { PING_SECURE_TOKEN_KEY, registerPushToken } from "../lib/api";

type AuthState = {
  user: api.AuthUser | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, referralCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const token = await SecureStore.getItemAsync(PING_SECURE_TOKEN_KEY);
    if (token) api.setAuthToken(token);
    try {
      const u = await api.fetchMe();
      setUser(u);
      if (u) {
        try {
          const Notifications = await import("expo-notifications");
          const pushToken = await Notifications.getExpoPushTokenAsync();
          if (pushToken?.data) await registerPushToken(pushToken.data);
        } catch {
          // Expo Go не поддерживает push (SDK 53+), или отклонено — игнорируем
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const login = useCallback(
    async (phone: string, password: string) => {
      const { user: u, token } = await api.login(phone, password);
      if (token) await SecureStore.setItemAsync(PING_SECURE_TOKEN_KEY, token);
      setUser(u);
    },
    []
  );

  const register = useCallback(
    async (phone: string, password: string, referralCode: string) => {
      const { user: u, token } = await api.register(phone, password, referralCode);
      if (token) await SecureStore.setItemAsync(PING_SECURE_TOKEN_KEY, token);
      setUser(u);
    },
    []
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
