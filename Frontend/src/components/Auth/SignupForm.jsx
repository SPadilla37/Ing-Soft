import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';

const SignupForm = ({ onLoginTab }) => {
  const { setSession, setCurrentUserRecord } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    apellido: '',
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSignup = async () => {
    const { name, email, password, username, apellido } = formData;
    if (!name || !email || !password || password.length < 4) {
      alert('Completa nombre, correo y una contraseña de al menos 4 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiRequest(API_BASE, '/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, name, apellido, password }),
      });
      setCurrentUserRecord(result.user);
      setSession(result.user.id);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="signupPane" className="form-shell">
      <h2>Create your account</h2>
      <p>Crea tu cuenta con nombre, correo y contraseña. Luego completas el perfil con tus habilidades.</p>
      <label>Nombre</label>
      <input id="name" placeholder="Pedro" value={formData.name} onChange={handleChange} />
      <label>Apellido</label>
      <input id="apellido" placeholder="González" value={formData.apellido} onChange={handleChange} />
      <label>Nombre de usuario</label>
      <input id="username" placeholder="pedro_g" value={formData.username} onChange={handleChange} />
      <label>Correo</label>
      <input id="email" type="email" placeholder="correo@ejemplo.com" value={formData.email} onChange={handleChange} />
      <label>Contraseña</label>
      <input id="password" type="password" placeholder="Minimo 4 caracteres" value={formData.password} onChange={handleChange} />
      <button 
        className="primary-btn" 
        type="button" 
        onClick={handleSignup}
        disabled={loading}
      >
        {loading ? 'Cargando...' : 'Crear cuenta'}
      </button>
    </div>
  );
};

export default SignupForm;
