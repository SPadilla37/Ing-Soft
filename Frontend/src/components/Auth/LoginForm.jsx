import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';

const LoginForm = ({ onSignupTab }) => {
  const { setSession, setCurrentUserRecord } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Por favor, ingresa correo y contraseña.');
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
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="loginPane" className="form-shell">
      <h2>Welcome back</h2>
      <p>Ingresa con tu correo para continuar en tu dashboard de intercambios.</p>
      <label>Correo</label>
      <input 
        type="email" 
        placeholder="correo@ejemplo.com" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label>Contraseña</label>
      <input 
        type="password" 
        placeholder="Tu contraseña" 
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button 
        className="primary-btn" 
        type="button" 
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? 'Cargando...' : 'Entrar'}
      </button>
    </div>
  );
};

export default LoginForm;
