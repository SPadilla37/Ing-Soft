import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbKeySession, dbKeyToken } from '../config/constants';
import { api as apiRequest } from '../services/api';
import { API_BASE } from '../config/constants';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const normalizeUserRecord = (user) => {
  if (!user || typeof user !== 'object') return null;

  const teachSkills = Array.isArray(user.habilidades_ofertadas)
    ? user.habilidades_ofertadas
        .map((skill) => skill?.nombre)
        .filter((name) => typeof name === 'string' && name.trim())
    : [];

  const learnSkills = Array.isArray(user.habilidades_buscadas)
    ? user.habilidades_buscadas
        .map((skill) => skill?.nombre)
        .filter((name) => typeof name === 'string' && name.trim())
    : [];

  const fullName = [user.nombre, user.apellido]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();

  return {
    ...user,
    name: fullName || user.username || user.email || String(user.id),
    profile: {
      fullName,
      bio: user.biografia || '',
      teachSkills,
      learnSkills,
      languages: [],
    },
  };
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem(dbKeySession) || null);
  const [currentUserRecord, setCurrentUserRecordState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuspendedPopup, setShowSuspendedPopup] = useState(false);

  const setCurrentUserRecord = (userRecord) => {
    setCurrentUserRecordState(normalizeUserRecord(userRecord));
  };

  const setSession = (userId, token = null) => {
    localStorage.setItem(dbKeySession, userId);
    if (token) {
      localStorage.setItem(dbKeyToken, token);
    }
    setCurrentUser(userId);
  };

  const clearSession = () => {
    localStorage.removeItem(dbKeySession);
    localStorage.removeItem(dbKeyToken);
    setCurrentUser(null);
    setCurrentUserRecordState(null);
    setShowSuspendedPopup(false);
  };

  const loadUserRecord = async (userId) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const result = await apiRequest(API_BASE, `/usuarios/${encodeURIComponent(userId)}`);
      if (!result || !result.user) {
        clearSession();
        return;
      }
      
      if (result.user.is_suspended) {
        clearSession();
        setShowSuspendedPopup(true);
        return;
      }
      
      setCurrentUserRecordState(normalizeUserRecord(result.user));
    } catch (error) {
      console.error('Failed to load user record:', error);
      clearSession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadUserRecord(currentUser);
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      currentUserRecord, 
      setSession, 
      clearSession, 
      loading, 
      setCurrentUserRecord,
      showSuspendedPopup,
      setShowSuspendedPopup
    }}>
      {children}
    </AuthContext.Provider>
  );
};
