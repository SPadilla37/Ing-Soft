import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

const AuthScreen = () => {
  const [mode, setMode] = useState('login');

  return (
    <section className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute w-96 h-96 bg-primary-dim/20 rounded-full -left-32 top-0 blur-3xl opacity-40 pointer-events-none"></div>
      <div className="absolute w-80 h-80 bg-secondary/20 rounded-full -right-20 bottom-10 blur-3xl opacity-40 pointer-events-none"></div>

      <div className="w-full max-w-6xl grid md:grid-cols-[1.1fr_0.9fr] gap-4 relative z-10">
        {/* Welcome Panel */}
        <div className="bg-gradient-to-br from-primary-dim/30 via-surface-container-high/60 to-surface-container/40 backdrop-blur-xl border border-outline-variant/20 rounded-3xl p-8 md:p-12 flex flex-col justify-between min-h-[650px] shadow-2xl">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-dim to-primary flex items-center justify-center text-white font-bold text-xl shadow-lg">
                H
              </div>
              <span className="font-headline font-bold text-2xl text-on-surface">Habilio</span>
            </div>
            
            <div className="mb-8">
              <h1 className="font-headline font-extrabold text-5xl md:text-6xl text-on-surface leading-tight mb-4">
                Aprende. Enseña. <span className="text-secondary">Conecta.</span>
              </h1>
              <p className="text-on-surface-variant text-lg leading-relaxed max-w-lg">
                Encuentra personas que quieran aprender lo que tú dominas y que puedan enseñarte algo que tú necesitas. Publica tu intercambio, aparece en el buscador y activa el chat solo cuando alguien acepte.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-surface-container-high/60 backdrop-blur-sm rounded-2xl p-5 border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
                <strong className="text-on-surface font-semibold">Crea tu perfil</strong>
              </div>
              <span className="text-on-surface-variant text-sm leading-relaxed">
                Agrega tus datos básicos y las habilidades que ofreces y quieres aprender.
              </span>
            </div>
            
            <div className="bg-surface-container-high/60 backdrop-blur-sm rounded-2xl p-5 border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-secondary text-2xl">search</span>
                <strong className="text-on-surface font-semibold">Aparece en matches</strong>
              </div>
              <span className="text-on-surface-variant text-sm leading-relaxed">
                Tu solicitud se vuelve visible para otros usuarios en el dashboard.
              </span>
            </div>
            
            <div className="bg-surface-container-high/60 backdrop-blur-sm rounded-2xl p-5 border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-tertiary text-2xl">chat</span>
                <strong className="text-on-surface font-semibold">Chatea al aceptar</strong>
              </div>
              <span className="text-on-surface-variant text-sm leading-relaxed">
                Solo después de aceptar se habilita la conversación en tiempo real.
              </span>
            </div>
          </div>
        </div>

        {/* Auth Panel */}
        <div className="bg-surface-container-high/80 backdrop-blur-xl border border-outline-variant/20 rounded-3xl p-6 min-h-[650px] flex flex-col gap-4 shadow-2xl">
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-surface-container-low/50 rounded-2xl border border-outline-variant/10">
            <button 
              className={`py-3 px-4 rounded-xl font-bold transition-all ${
                mode === 'login' 
                  ? 'bg-gradient-to-br from-primary-dim to-primary text-white shadow-lg' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => setMode('login')}
            >
              Iniciar sesión
            </button>
            <button 
              className={`py-3 px-4 rounded-xl font-bold transition-all ${
                mode === 'signup' 
                  ? 'bg-gradient-to-br from-primary-dim to-primary text-white shadow-lg' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
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
