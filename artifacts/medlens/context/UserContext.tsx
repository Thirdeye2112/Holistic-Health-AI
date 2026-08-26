import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth, useUser } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type UserContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  credits: number | null;
  refreshCredits: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null);
  }, [isSignedIn, getToken]);

  const refreshCredits = useCallback(async () => {
    if (!isSignedIn) {
      setCredits(null);
      return;
    }
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/stripe/balance`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = (await response.json()) as { credits: number };
        setCredits(data.credits);
      }
    } catch {
      // non-fatal
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      void refreshCredits();
    } else if (authLoaded && !isSignedIn) {
      setCredits(null);
    }
  }, [authLoaded, isSignedIn, refreshCredits]);

  void user;

  const value = useMemo<UserContextValue>(
    () => ({
      isLoaded: authLoaded,
      isSignedIn: Boolean(isSignedIn),
      credits,
      refreshCredits,
    }),
    [authLoaded, isSignedIn, credits, refreshCredits],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserContext must be used within UserProvider");
  return ctx;
}
