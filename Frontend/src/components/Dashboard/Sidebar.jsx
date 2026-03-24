import React from 'react';
import { useAuth } from '../../context/AuthContext';
import logoHabilio from '../../assets/logo.png';

const Sidebar = ({ activeView, setActiveView, badges }) => {
  const { clearSession } = useAuth();

  const navItems = [
    { id: 'matchesView', label: 'Matches' },
    { id: 'incomingMatchesView', label: 'Intereses recibidos', badgeKey: 'incoming' },
    { id: 'myMatchesView', label: 'Mis Matches', badgeKey: 'myMatches' },
    { id: 'historyView', label: 'Historial' },
    { id: 'chatView', label: 'Chat', badgeKey: 'chat' },
    { id: 'profileView', label: 'Perfil' },
  ];

return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        {/* CAMBIA EL SRC AQUÍ: Usa la variable entre llaves */}
        <img src={logoHabilio} alt="Habilio" className="brand-logo" />
        <span>Habilio</span>
      </div>

      <div className="nav-list">
        {navItems.map(item => (
          <button 
            key={item.id}
            className={`nav-btn ${activeView === item.id ? 'active' : ''}`}
            onClick={() => setActiveView(item.id)}
          >
            {item.label} 
            {item.badgeKey && badges[item.badgeKey] > 0 && (
              <span className="badge">{badges[item.badgeKey]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="sidebar-note">
        Solo despues de que otro usuario acepte tu solicitud, ambos podran hablar por el chat.
      </div>
    </aside>
  );
};

export default Sidebar;
