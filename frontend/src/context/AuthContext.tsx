import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  updateMe as apiUpdateMe,
  deleteMe as apiDeleteMe,
  clearTokens,
  hasTokens,
  setAuthExpiredHandler,
} from '../api/client';
import type { AuthResponse, UserProfile } from '../api/client';

type AuthUser = UserProfile;

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: { name?: string; avatarSeed?: string | null }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (hasTokens()) {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        try {
          return JSON.parse(stored) as AuthUser;
        } catch {
          localStorage.removeItem('auth_user');
        }
      }
    }
    return null;
  });
  const [isLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle token expiration
  useEffect(() => {
    setAuthExpiredHandler(() => {
      setUser(null);
      localStorage.removeItem('auth_user');
    });
  }, []);

  const handleAuth = useCallback((resp: AuthResponse) => {
    const u: AuthUser = {
      id: resp.user.id,
      email: resp.user.email,
      name: resp.user.name,
      avatarSeed: resp.user.avatarSeed,
      plan: resp.user.plan,
      effectivePlan: resp.user.effectivePlan,
      trialEndsAt: resp.user.trialEndsAt,
      planUpdatedAt: resp.user.planUpdatedAt,
    };
    setUser(u);
    localStorage.setItem('auth_user', JSON.stringify(u));
    setError(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const resp = await apiLogin(email, password);
        handleAuth(resp);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Login failed';
        setError(msg);
        throw e;
      }
    },
    [handleAuth]
  );

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      setError(null);
      try {
        const resp = await apiRegister(email, name, password);
        handleAuth(resp);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Registration failed';
        setError(msg);
        throw e;
      }
    },
    [handleAuth]
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    localStorage.removeItem('auth_user');
  }, []);

  const updateProfile = useCallback(
    async (patch: { name?: string; avatarSeed?: string | null }) => {
      const updated = await apiUpdateMe(patch);
      setUser(updated);
      localStorage.setItem('auth_user', JSON.stringify(updated));
    },
    []
  );

  const deleteAccount = useCallback(async () => {
    await apiDeleteMe();
    setUser(null);
    localStorage.removeItem('auth_user');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        deleteAccount,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
