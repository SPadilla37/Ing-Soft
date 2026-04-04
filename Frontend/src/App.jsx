import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthScreen from './components/Auth/AuthScreen';
import Dashboard from './components/Dashboard/Dashboard';
import OnboardingModal from './components/Onboarding/OnboardingModal';
import AdminDashboard from './components/Admin/AdminDashboard';

function AppRoutes() {
  const { currentUserRecord, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirected = useRef(false);

  // Solución 1: Resetear el ref cuando cambia el usuario
  useEffect(() => {
    hasRedirected.current = false;
  }, [currentUser]);

  // Solución 2: Forzar redirección basada en rol sin importar la ruta actual
  useEffect(() => {
    if (currentUserRecord?.role && !hasRedirected.current) {
      hasRedirected.current = true;
      const userRole = currentUserRecord.role;
      const currentPath = location.pathname;
      
      // Si es admin/superadmin y NO está en rutas de admin, redirigir
      if (['admin', 'superadmin'].includes(userRole) && !currentPath.startsWith('/admin')) {
        navigate('/admin/dashboard', { replace: true });
      }
      // Si es user y está en rutas de admin, redirigir a dashboard
      else if (userRole === 'user' && currentPath.startsWith('/admin')) {
        navigate('/dashboard', { replace: true });
      }
      // Si está en la ruta raíz, redirigir según el rol
      else if (currentPath === '/') {
        if (['admin', 'superadmin'].includes(userRole)) {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    }
  }, [currentUserRecord?.role, location.pathname, navigate, currentUser]);

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
  const { currentUser, currentUserRecord, loading, showSuspendedPopup, setShowSuspendedPopup } = useAuth();

  if (loading) {
    return <div className="loading-screen">Cargando...</div>;
  }

  if (showSuspendedPopup) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-container rounded-2xl p-6 max-w-md border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-error text-3xl">block</span>
            <h3 className="text-on-surface text-lg font-semibold">
              Cuenta Suspendida
            </h3>
          </div>
          <p className="text-on-surface-variant mb-6">
            Tu cuenta ha sido suspendida. Por favor, contacta al administrador para más información.
          </p>
          <button
            onClick={() => {
              setShowSuspendedPopup(false);
              window.location.href = '/';
            }}
            className="w-full bg-primary text-white font-bold py-3 rounded-full"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  const profile = currentUserRecord?.profile;
  const userRole = currentUserRecord?.role || 'user';
  const isAdmin = ['admin', 'superadmin'].includes(userRole);
  const needsOnboarding = !isAdmin && (!profile || !profile.teachSkills?.length || !profile.learnSkills?.length);

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
