import React from 'react';
import { useAuth } from '../../context/AuthContext';

const TopBar = ({ onSearch, showSearch }) => {
  const { currentUser, currentUserRecord, clearSession } = useAuth();
  
  const profile = currentUserRecord?.profile || {};
  const visibleName = profile.fullName || currentUserRecord?.name || currentUser;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className={`top-shell ${!showSearch ? 'user-only' : ''}`}>
      {showSearch && (
        <div className="search-shell">
          <input 
            id="searchInput" 
            placeholder="Buscar habilidades..." 
            onChange={(e) => onSearch(e.target.value)}
          />
          <button className="secondary-btn">Buscar</button>
        </div>
      )}
      <div className="top-user">
        <div className="avatar">{getInitials(visibleName)}</div>
        <div>
          <strong>{visibleName}</strong>
          <div className="muted">{(profile.languages || []).join(' · ') || 'Tu dashboard'}</div>
        </div>
        <button className="mini-btn" onClick={clearSession}>Salir</button>
      </div>
    </div>
  );
};

export default TopBar;
