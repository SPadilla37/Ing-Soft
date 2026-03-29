import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validateUsername = (username) => {
  if (!username || username.trim() === '') {
    return 'El nombre de usuario es requerido';
  }
  if (/^[\d]+$/.test(username)) {
    return 'El nombre de usuario no puede ser solo números';
  }
  if (/^[^\w]+$/.test(username)) {
    return 'El nombre de usuario no puede tener solo caracteres especiales';
  }
  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    return 'Solo letras, números, puntos (.) y guiones bajos (_)';
  }
  if (/\s/.test(username)) {
    return 'No se permiten espacios';
  }
  return '';
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
        const error = validateUsername(value);
        if (error) setUsernameError(error);
      }
    }
  };

  const usernameValidation = validateUsername(formData.username);
  const canSubmit = formData.username.trim() !== '' && formData.email.trim() !== '' && formData.password.trim() !== '' && validateEmail(formData.email) === true && usernameValidation === '' && !loading;

  const handleSignup = async () => {
    const { email, password, username } = formData;
    const usernameVal = validateUsername(username);
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
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="signupPane" className="form-shell">
      <h2>Crea tu cuenta</h2>
      <p>Ingresa usuario, correo y contraseña. En el siguiente paso completas tu perfil.</p>
      <label>Nombre de usuario</label>
      <input id="username" placeholder="pedro_g" value={formData.username} onChange={handleChange} maxLength={12} />
      {usernameError && <span className="error-message" style={{color: 'red'}}>{usernameError}</span>}
      <label>Correo</label>
      <input id="email" type="email" placeholder="correo@ejemplo.com" value={formData.email} onChange={handleChange} maxLength={25} />
      {emailError && <span className="error-message" style={{color: 'red'}}>{emailError}</span>}
      <label>Contraseña</label>
      <input id="password" type="password" placeholder="Minimo 4 caracteres" value={formData.password} onChange={handleChange} maxLength={50} />
      <button 
        className="primary-btn" 
        type="button" 
        onClick={handleSignup}
        disabled={!canSubmit}
      >
        {loading ? 'Cargando...' : 'Crear cuenta'}
      </button>
    </div>
  );
};

export default SignupForm;
