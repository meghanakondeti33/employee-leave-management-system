import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, ApiError } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Restore authenticated session on application startup
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        if (response && response.success && response.user) {
          setUser(response.user);
          setToken(storedToken);
          setIsAuthenticated(true);
        } else {
          logout();
        }
      } catch (err) {
        // Token invalid or expired
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    // Event listener for unauthorized API responses
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response && response.success && response.token && response.user) {
        localStorage.setItem('token', response.token);
        setToken(response.token);
        setUser(response.user);
        setIsAuthenticated(true);
        return { success: true, user: response.user };
      } else {
        throw new Error(response.message || 'Login failed.');
      }
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Invalid email or password.',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
