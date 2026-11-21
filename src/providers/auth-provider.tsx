"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@/types/domain";
import { INITIAL_USERS } from "@/lib/mock-db";

interface AuthContextValue {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  loginWithPin: (userId: string, pin: string) => Promise<{ success: boolean; error?: string; isLocked?: boolean }>;
  logout: () => Promise<void>;
  setCurrentUserDirect: (user: User | null) => void;
  refreshUsers: () => Promise<User[]>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function reconcileUserWithCanonical(
  rawUser: User | null | undefined,
  canonicalUsers: User[]
): User | null {
  if (!rawUser || !rawUser.id) return null;
  if (canonicalUsers.length === 0) return null;
  const matched = canonicalUsers.find((u) => u.id === rawUser.id);
  return matched ? { ...matched } : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsers = useCallback(async (): Promise<User[]> => {
    try {
      const res = await fetch("/api/auth/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setUsers(data.users as User[]);
          return data.users as User[];
        }
      }
    } catch {
      // Fallback to existing users state
    }
    return users;
  }, [users]);

  useEffect(() => {
    let active = true;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "CT_CURRENT_USER") {
        try {
          const parsed = e.newValue ? (JSON.parse(e.newValue) as User) : null;
          setCurrentUser((prev) => {
            if (!parsed) return null;
            const matched = users.find((u) => u.id === parsed.id);
            return matched ? { ...matched } : prev?.id === parsed.id ? prev : null;
          });
        } catch {
          setCurrentUser(null);
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    async function loadSession() {
      let latestUsers: User[] = INITIAL_USERS;
      try {
        const usersRes = await fetch("/api/auth/users", { cache: "no-store" });
        if (usersRes.ok) {
          const usersJson = await usersRes.json();
          if (active && Array.isArray(usersJson.users)) {
            latestUsers = usersJson.users as User[];
            setUsers(latestUsers);
          }
        }
      } catch {
        // Ignore users fetch error
      }

      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (meRes.ok) {
          const data = await meRes.json();
          if (active && data.authenticated && data.user) {
            const matched = latestUsers.find((u) => u.id === data.user.id);
            const resolvedUser: User = matched
              ? { ...matched }
              : {
                  ...data.user,
                  failed_pin_attempts: 0,
                  created_at: new Date().toISOString(),
                };
            setCurrentUser(resolvedUser);
            try {
              localStorage.setItem("CT_CURRENT_USER", JSON.stringify(resolvedUser));
            } catch {}
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to reconciled localStorage below
      }

      if (active) {
        let cachedUser: User | null = null;
        try {
          const saved = localStorage.getItem("CT_CURRENT_USER");
          if (saved) {
            cachedUser = reconcileUserWithCanonical(JSON.parse(saved) as User, latestUsers);
            if (!cachedUser) {
              localStorage.removeItem("CT_CURRENT_USER");
            }
          }
        } catch {
          cachedUser = null;
        }
        setCurrentUser(cachedUser);
        setIsLoading(false);
      }
    }

    loadSession();
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const loginWithPin = useCallback(async (userId: string, pin: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || "PIN salah",
          isLocked: Boolean(data.is_locked),
        };
      }
      setCurrentUser(data.user);
      try {
        localStorage.setItem("CT_CURRENT_USER", JSON.stringify(data.user));
      } catch {}
      return { success: true };
    } catch {
      return { success: false, error: "Gagal terhubung ke server" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setCurrentUser(null);
    try {
      localStorage.removeItem("CT_CURRENT_USER");
    } catch {}
  }, []);

  const setCurrentUserDirect = useCallback((user: User | null) => {
    setCurrentUser(user);
    try {
      if (user) {
        localStorage.setItem("CT_CURRENT_USER", JSON.stringify(user));
      } else {
        localStorage.removeItem("CT_CURRENT_USER");
      }
    } catch {}
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        isLoading,
        loginWithPin,
        logout,
        setCurrentUserDirect,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
