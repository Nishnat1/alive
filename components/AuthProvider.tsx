"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken, API_URL, fetchJSON } from "@/lib/api";

const AuthContext = createContext(null);

const USER_KEY = "fittrack-user";

function readStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLocationEnabled(false);
      setLoading(false);
      return;
    }

    const stored = readStoredUser();
    if (stored) {
      setUser(stored);
      setLoading(false);
    }

    fetchJSON(`${API_URL}/auth/me`)
      .then(({ data }) => {
        setUser(data.user);
        setLocationEnabled(true);
        window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setLocationEnabled(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const userId = user?.id;

  useEffect(() => {
    setLocation(null);
    setLocationError("");

    if (!userId || !locationEnabled) return;

    if (!navigator.geolocation) {
      setLocationError("This browser does not support location access.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setLocationError("");
      },
      (error) => {
        if (error.code === 1) {
          setLocationError(
            "Location permission denied. Enable location in your browser settings."
          );
        } else if (error.code === 2) {
          setLocationError(
            "Your location is unavailable. Check that location services are enabled."
          );
        } else if (error.code === 3) {
          setLocationError(
            "Location request timed out. Move somewhere with a clear GPS signal."
          );
        } else {
          setLocationError("Unable to get your location.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId, locationEnabled]);

  const login = useCallback((token, userData) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("fittrack-token", token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(userData));
    }
    setLocation(null);
    setLocationError("");
    setLocationEnabled(true);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setLocation(null);
    setLocationError("");
    setLocationEnabled(false);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      location,
      locationError,
      isAuthenticated: !!user,
      login,
      logout,
    }),
    [user, loading, location, locationError, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function useRequireAuth() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return { user, loading, logout };
}
