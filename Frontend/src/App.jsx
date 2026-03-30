import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthScreen from './components/Auth/AuthScreen';
import Dashboard from './components/Dashboard/Dashboard';
import OnboardingModal from './components/Onboarding/OnboardingModal';
import AdminDashboard from './components/Admin/AdminDashboard';

function AppRoutes() {
  const { currentUserRecord } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect once when user first loads and is on root path
    if (currentUserRecord?.role && location.pathname === '/' && !hasRedirected.current) {
      hasRedirected.current = true;
      const userRole = currentUserRecord.role;
      if (['admin', 'superadmin'].includes(userRole)) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [currentUserRecord?.role, location.pathname, navigate]);

  // Determine default route based on role
  const userRole = currentUserRecord?.role || 'user';
  const defaultRoute = ['admin', 'superadmin'].includes(userRole) ? '/admin/dashboard' : '/dashboard';

  return (
    <Routes>
      <Route path="/admin/*" element={<AdminDashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  );
}

function AppContent() {
  const { currentUser, currentUserRecord, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Cargando...</div>;
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  const profile = currentUserRecord?.profile;
  const needsOnboarding = !profile || !profile.teachSkills?.length || !profile.learnSkills?.length;

  if (needsOnboarding) {
    return <OnboardingModal />;
  }

  return (
    <BrowserRouter basename="/Ing-Soft/Frontend">
      <AppRoutes />
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
