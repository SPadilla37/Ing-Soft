import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { dbKeySession, dbKeyToken } from '../config/constants';
import { api as apiRequest } from '../services/api';
import { API_BASE } from '../config/constants';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const getStoredSessionUser = () => {
  const stored = localStorage.getItem(dbKeySession);
  if (!stored) return null;

  const normalized = String(stored).trim();
  if (!/^\d+$/.test(normalized) || Number(normalized) <= 0) {
    localStorage.removeItem(dbKeySession);
    return null;
  }

  return normalized;
};

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
  const [currentUser, setCurrentUser] = useState(getStoredSessionUser());
  const [currentUserRecord, setCurrentUserRecordState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuspendedPopup, setShowSuspendedPopup] = useState(false);
  const eventSourceRef = useRef(null);

  const setCurrentUserRecord = (userRecord) => {
    setCurrentUserRecordState(normalizeUserRecord(userRecord));
  };

  const setSession = (userId, token = null) => {
    const normalizedUserId = String(userId).trim();
    if (!/^\d+$/.test(normalizedUserId) || Number(normalizedUserId) <= 0) {
      return;
    }

    localStorage.setItem(dbKeySession, normalizedUserId);
    if (token) {
      localStorage.setItem(dbKeyToken, token);
    }
    setCurrentUser(normalizedUserId);
  };

  const clearSession = () => {
    localStorage.removeItem(dbKeySession);
    localStorage.removeItem(dbKeyToken);
    setCurrentUser(null);
    setCurrentUserRecordState(null);
    setShowSuspendedPopup(false);
  };

  const handleAccountSuspended = useCallback(() => {
    clearSession();
    setShowSuspendedPopup(true);
  }, []);

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

  const setupSSE = useCallback((userId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_BASE}/notifications/stream/${userId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'account_suspended') {
          handleAccountSuspended();
        }
      } catch (e) {
        console.error('Error parsing SSE message:', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
    };
  }, [handleAccountSuspended]);

  useEffect(() => {
    if (currentUser) {
      loadUserRecord(currentUser);
      setupSSE(currentUser);
    } else {
      setLoading(false);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [currentUser, setupSSE]);

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      currentUserRecord, 
      setSession, 
      clearSession, 
      loading, 
      setCurrentUserRecord,
      showSuspendedPopup,
      setShowSuspendedPopup,
      loadUserRecord
    }}>
      {children}
    </AuthContext.Provider>
  );
};
