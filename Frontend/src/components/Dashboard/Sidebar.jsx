import React from 'react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ activeView, setActiveView, badges }) => {
  const { clearSession } = useAuth();

  const navItems = [
    { id: 'matchesView', label: 'Matches', badgeKey: 'matches' },
    { id: 'incomingMatchesView', label: 'Intereses recibidos', badgeKey: 'incoming' },
    { id: 'myMatchesView', label: 'Mis matches', badgeKey: 'myMatches' },
    { id: 'historyView', label: 'Historial' },
    { id: 'chatView', label: 'Chat', badgeKey: 'chat' },
    { id: 'profileView', label: 'Perfil' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">S</span>
        <span>SkillSwap</span>
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
