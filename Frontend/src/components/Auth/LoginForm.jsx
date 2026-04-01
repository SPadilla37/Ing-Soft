import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const LoginForm = ({ onSignupTab }) => {
  const { setSession, setCurrentUserRecord } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [showSuspendedPopup, setShowSuspendedPopup] = useState(false);

  const isEmailValid = validateEmail(email);
  const canSubmit = email.trim() !== '' && password.trim() !== '' && isEmailValid && !loading;

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Por favor, ingresa correo y contraseña.');
      return;
    }
    if (!validateEmail(email)) {
      setEmailError('Este correo no es válido');
      return;
    }
    setLoading(true);
    try {
      const result = await apiRequest(API_BASE, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setCurrentUserRecord(result.user);
      setSession(result.user.id, result.access_token || null);
    } catch (error) {
      if (error.message === 'ACCOUNT_SUSPENDED') {
        setShowSuspendedPopup(true);
      } else {
        alert(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container/50 backdrop-blur-sm rounded-2xl p-6 border border-outline-variant/10 flex-1 flex flex-col">
      <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Bienvenido de nuevo</h2>
      <p className="text-on-surface-variant mb-6">
        Ingresa con tu correo para continuar en tu dashboard de intercambios.
      </p>
      
      <div className="space-y-4 flex-1">
        <div>
          <label className="block text-sm font-semibold text-on-surface mb-2">Correo</label>
          <input 
            type="email" 
            placeholder="correo@ejemplo.com" 
            value={email}
            onChange={(e) => {
              const { value } = e.target;
              setEmail(value);
              setEmailError('');
              if (value && !validateEmail(value)) {
                setEmailError('Este correo no es válido');
              }
            }}
            maxLength={25}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          {emailError && <span className="text-error text-xs mt-1 block">{emailError}</span>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-on-surface mb-2">Contraseña</label>
          <input 
            type="password" 
            placeholder="Tu contraseña" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={50}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
      </div>

      <button 
        type="button" 
        onClick={handleLogin}
        disabled={!canSubmit}
        className="w-full mt-6 bg-gradient-to-br from-primary-dim to-primary hover:from-primary hover:to-primary-dim text-white font-bold py-4 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
      >
        {loading ? 'Cargando...' : 'Entrar'}
      </button>

      {showSuspendedPopup && (
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
              onClick={() => setShowSuspendedPopup(false)}
              className="w-full bg-primary text-white font-bold py-3 rounded-full"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginForm;
