import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbKeySession } from '../config/constants';
import { api as apiRequest } from '../services/api';
import { API_BASE } from '../config/constants';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem(dbKeySession) || null);
  const [currentUserRecord, setCurrentUserRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const setSession = (userId) => {
    localStorage.setItem(dbKeySession, userId);
    setCurrentUser(userId);
  };

  const clearSession = () => {
    localStorage.removeItem(dbKeySession);
    setCurrentUser(null);
    setCurrentUserRecord(null);
  };

  const loadUserRecord = async (userId) => {
    if (!userId) return;
    try {
      const user = await apiRequest(API_BASE, `/users/${encodeURIComponent(userId)}`);
      setCurrentUserRecord(user);
    } catch (error) {
      console.error('Failed to load user record:', error);
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
    <AuthContext.Provider value={{ currentUser, currentUserRecord, setSession, clearSession, loading, setCurrentUserRecord }}>
      {children}
    </AuthContext.Provider>
  );
};
