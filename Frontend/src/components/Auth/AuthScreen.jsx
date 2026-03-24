import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

const AuthScreen = () => {
  const [mode, setMode] = useState('login');

  return (
    <section id="authScreen" className="auth-screen">
      <div className="auth-card">
        <div className="welcome-panel glass">
          <div>
            <div className="brand-row">
              <span className="brand-mark">H</span>
              <span>Habilio</span>
            </div>
            <div className="welcome-copy">
              <h1>Aprende. Enseña. <span>Conecta.</span></h1>
              <p>Encuentra personas que quieran aprender lo que tu dominas y que puedan ensenarte algo que tu necesitas. Publica tu intercambio, aparece en el buscador y activa el chat solo cuando alguien acepte.</p>
            </div>
          </div>
          <div className="auth-points">
            <div className="auth-point">
              <strong>1. Crea tu perfil</strong>
              <span>Agrega tus datos basicos y las habilidades que ofreces y quieres aprender.</span>
            </div>
            <div className="auth-point">
              <strong>2. Aparece en matches</strong>
              <span>Tu solicitud se vuelve visible para otros usuarios en el dashboard.</span>
            </div>
            <div className="auth-point">
              <strong>3. Chatea al aceptar</strong>
              <span>Solo despues de aceptar se habilita la conversacion en tiempo real.</span>
            </div>
          </div>
        </div>

        <div className="auth-panel glass">
          <div className="tab-row">
            <button 
              className={`tab-btn ${mode === 'login' ? 'active' : ''}`} 
              onClick={() => setMode('login')}
            >
              Iniciar sesión
            </button>
            <button 
              className={`tab-btn ${mode === 'signup' ? 'active' : ''}`} 
              onClick={() => setMode('signup')}
            >
              Crear cuenta
            </button>
          </div>

          {mode === 'login' ? (
            <LoginForm onSignupTab={() => setMode('signup')} />
          ) : (
            <SignupForm onLoginTab={() => setMode('login')} />
          )}
        </div>
      </div>
    </section>
  );
};

export default AuthScreen;
