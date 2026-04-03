import React from 'react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard/Dashboard';
import OnboardingModal from './components/Onboarding/OnboardingModal';
import AuthScreen from './components/Auth/AuthScreen';

function App() {
  const { isLoaded, isSignedIn, loadUserRecord, dbUser } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        setLoading(true); // Activamos carga al detectar el inicio de sesión
        loadUserRecord().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
}, [isLoaded, isSignedIn, loadUserRecord]);

  // Timeout para evitar loading infinito si backend está lento
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  if (!isLoaded || loading) {
    return <div className="loading-screen">Cargando...</div>;
  }

  // Detección de perfil: aceptamos nombre del backend o de Clerk
  const hasName = Boolean(dbUser?.nombre || dbUser?.firstName || dbUser?.profile?.fullName);

  // Comprobamos habilidades buscando en todas las propiedades posibles del objeto dbUser
  // Añadimos una verificación más flexible para detectar si el array existe y tiene contenido
  const getSkills = (user, primaryKey, secondaryKey, fallbackKey) => {
    const list = user?.[primaryKey] || user?.[secondaryKey] || user?.profile?.[fallbackKey];
    if (Array.isArray(list) && list.length > 0) return list;
    if (Array.isArray(user?.habilidades)) {
      return user.habilidades.filter(h => h.tipo === primaryKey.split('_')[1] || h.categoria === primaryKey.split('_')[1]);
    }
    return [];
  };

  const offers = getSkills(dbUser, 'habilidades_ofertadas', 'habilidades_ofrece', 'teachSkills');
  const wants = getSkills(dbUser, 'habilidades_buscadas', 'habilidades_busca', 'learnSkills');
  
  // Un perfil completo requiere al menos una habilidad para ofrecer Y una para aprender
  const hasSkills = (offers.length > 0 && wants.length > 0);

  // Solo exigimos onboarding si estamos seguros de que falta información crítica
  // Agregamos un chequeo de 'loading' para no mostrar el modal por error mientras carga el record
  const needsOnboarding = isSignedIn && !loading && (!dbUser || !hasName || !hasSkills);

  // Debug para ver por qué no avanza (puedes borrarlo después)
  if (isSignedIn && needsOnboarding && dbUser) {
    console.log('Onboarding requerido aún:', { hasName, hasSkills, dbUser });
  }

  return (
    <>
      <SignedOut>
        <AuthScreen />
      </SignedOut>
      <SignedIn>
        {needsOnboarding ? <OnboardingModal /> : <Dashboard />}
      </SignedIn>
    </>
  );
}

export default App;
