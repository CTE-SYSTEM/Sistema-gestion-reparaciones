import React, { createContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { clearApiCache } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';

export const AuthContext = createContext();

const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'cte_user';

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clearSessionData = () => { queryClient.cancelQueries(); queryClient.clear(); clearApiCache(); };
  const [user, setUser] = useState(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);

    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const stored = sessionStorage.getItem(AUTH_USER_KEY);
    if (!token || !stored) {
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch {
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }
  });

  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.cancelQueries(); queryClient.clear(); clearApiCache();
      setUser(null);
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate, queryClient]);

  const login = async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    const { token, usuario } = response.data;
    clearSessionData();
    // Session storage keeps auth isolated per browser tab/window.
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);

    const userData = {
      id: usuario?.id,
      username: usuario?.nombre || username,
      rol: usuario?.rol,
    };
    setUser(userData);
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    return userData;
  };

  const updateUser = (account) => {
    setUser((current) => {
      const updated = { ...current, id: account.id_usuario, username: account.nombre_usuario, rol: account.rol };
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
      return updated;
    });
    clearSessionData();
  };

  const logout = (message) => {
    clearSessionData();
    setUser(null);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    navigate('/login', { replace: true, state: { message: typeof message === 'string' ? message : null } });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
