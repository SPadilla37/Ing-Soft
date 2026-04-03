import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// REMOVIDO: Signup custom reemplazado por Clerk SignUpButton en AuthScreen.jsx
// Archivo mantenido para referencia futura

export default SignupForm;
