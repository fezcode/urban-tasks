import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  clearTokens,
  hasTokens,
  setAuthExpiredHandler,
} from '../api/client';
import type { AuthResponse } from '../api/client';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
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
    const u = { id: resp.user.id, email: resp.user.email, name: resp.user.name };
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
