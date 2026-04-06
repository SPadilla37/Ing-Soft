import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';
import { parseModerationErrorMessage, validateUsernameText } from '../../utils/textModeration';
import SupportModal from './SupportModal';

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const SignupForm = ({ onLoginTab }) => {
  const { setSession, setCurrentUserRecord } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    if (id === 'email') {
      setEmailError('');
      if (value && !validateEmail(value)) {
        setEmailError('Este correo no es válido');
      }
    }
    if (id === 'username') {
      setUsernameError('');
      if (value) {
        const error = validateUsernameText(value);
        if (error) setUsernameError(error);
      }
    }
  };

  const usernameValidation = validateUsernameText(formData.username);
  const canSubmit = formData.username.trim() !== '' && formData.email.trim() !== '' && formData.password.trim() !== '' && validateEmail(formData.email) === true && usernameValidation === '' && !loading;

  const handleSignup = async () => {
    const { email, password, username } = formData;
    const usernameVal = validateUsernameText(username);
    if (usernameVal) {
      setUsernameError(usernameVal);
      return;
    }
    if (!username || !email || !password || password.length < 4) {
      alert('Completa usuario, correo y una contraseña de al menos 4 caracteres.');
      return;
    }
    if (!validateEmail(email)) {
      setEmailError('Este correo no es válido');
      return;
    }
    setLoading(true);
    try {
      const result = await apiRequest(API_BASE, '/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password, clerk_id: '' }),
      });
      setCurrentUserRecord(result.user);
      setSession(result.user.id, result.access_token || null);
    } catch (error) {
      const msg = error.message;
      const moderation = parseModerationErrorMessage(msg);
      if (moderation?.field === 'username' || msg.includes("nombre de usuario")) {
        setUsernameError(msg);
      } else if (msg.includes("correo")) {
        setEmailError(msg);
      } else {
        alert(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      
      <div className="bg-surface-container/50 backdrop-blur-sm rounded-2xl p-6 border border-outline-variant/10 flex-1 flex flex-col">
        <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">Crea tu cuenta</h2>
        <p className="text-on-surface-variant mb-6">
          Ingresa usuario, correo y contraseña. En el siguiente paso completas tu perfil.
        </p>
      
      <div className="space-y-4 flex-1">
        <div>
          <label className="block text-sm font-semibold text-on-surface mb-2">Nombre de usuario</label>
          <input 
            id="username" 
            placeholder="pedro_g" 
            value={formData.username} 
            onChange={handleChange} 
            maxLength={12}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          {usernameError && <span className="text-error text-xs mt-1 block">{usernameError}</span>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-on-surface mb-2">Correo</label>
          <input 
            id="email" 
            type="email" 
            placeholder="correo@ejemplo.com" 
            value={formData.email} 
            onChange={handleChange} 
            maxLength={50}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          {emailError && <span className="text-error text-xs mt-1 block">{emailError}</span>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-on-surface mb-2">Contraseña</label>
          <input 
            id="password" 
            type="password" 
            placeholder="Mínimo 4 caracteres" 
            value={formData.password} 
            onChange={handleChange} 
            maxLength={50}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
      </div>

      <button 
        type="button" 
        onClick={handleSignup}
        disabled={!canSubmit}
        className="w-full mt-6 bg-gradient-to-br from-primary-dim to-primary hover:from-primary hover:to-primary-dim text-white font-bold py-4 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
      >
        {loading ? 'Cargando...' : 'Crear cuenta'}
      </button>

      {/* Support Link */}
      <div className="mt-6 pt-6 border-t border-outline-variant/20">
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-on-surface-variant">¿Necesitas ayuda?</span>
          <button
            type="button"
            onClick={() => setShowSupportModal(true)}
            className="text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">support_agent</span>
            Contactar soporte
          </button>
        </div>
      </div>
      </div>
    </>
  );
};

export default SignupForm;
