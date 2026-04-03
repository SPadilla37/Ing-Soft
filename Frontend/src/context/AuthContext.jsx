import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useUser, useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { api as apiRequest } from '../services/api';
import { API_BASE } from '../config/constants';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { signOut } = useClerk();
  const auth = useClerkAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const [dbUserRecord, setDbUserRecord] = useState(null);

  const loadUserRecord = useCallback(async () => {
    if (!auth.isSignedIn || !auth.isLoaded || !user) return null;
    
    try {
      const token = await auth.getToken();
      const result = await apiRequest(API_BASE, `/usuarios/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('API /usuarios/me result:', result);
      const userData = result.user || result;
      setDbUserRecord(userData);
      return userData;
    } catch (error) {
      console.error('Failed to load user record:', error);
      return null;
    }
  }, [auth.isSignedIn, auth.isLoaded, user, auth.getToken]);

  const value = useMemo(() => ({
    isLoaded: auth.isLoaded && userLoaded,
    isSignedIn: auth.isSignedIn,
    user,
    getToken: auth.getToken,
    signOut,
    loadUserRecord,
    currentUser: dbUserRecord?.id || user?.id,
    currentUserRecord: dbUserRecord ? { ...user, ...dbUserRecord } : user,
    setCurrentUserRecord: setDbUserRecord,
    dbUser: dbUserRecord,
    clearSession: signOut, // Mapeamos clearSession a signOut de Clerk
  }), [auth.isLoaded, userLoaded, auth.isSignedIn, user, auth.getToken, signOut, loadUserRecord, dbUserRecord]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de un AuthProvider");
  return context;
};
