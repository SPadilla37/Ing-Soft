import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthScreen from './components/Auth/AuthScreen';
import Dashboard from './components/Dashboard/Dashboard'; // Will create this next
import OnboardingModal from './components/Onboarding/OnboardingModal'; // Will create this next

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

  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
