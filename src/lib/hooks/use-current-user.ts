"use client";

import { useAuth } from "@/providers/auth-provider";

export function useCurrentUser() {
  const { currentUser, isLoading, loginWithPin, logout } = useAuth();
  return { currentUser, isLoading, loginWithPin, logout };
}
