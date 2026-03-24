import React, { useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const TopBar = ({ onSearch, showSearch, titleView }) => {
  const { currentUser, currentUserRecord, clearSession } = useAuth();
  const searchInputRef = useRef(null);
  const searchBtnRef = useRef(null);
  
  const profile = currentUserRecord?.profile || {};
  const visibleName = profile.fullName || currentUserRecord?.name || currentUser;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Efecto para que el botón enfoque el input
  useEffect(() => {
    const searchInput = searchInputRef.current;
    const searchBtn = searchBtnRef.current;
    
    if (searchBtn && searchInput) {
      const handleClick = (e) => {
        e.preventDefault();
        searchInput.focus();
      };
      
      searchBtn.addEventListener('click', handleClick);
      
      return () => {
        searchBtn.removeEventListener('click', handleClick);
      };
    }
  }, []);

  // Manejar la búsqueda con Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(e.target.value);
    }
  };

  return (
    <div className="top-shell">
      {showSearch ? (
        <div className="search-shell">
          <input 
            ref={searchInputRef}
            id="searchInput" 
            placeholder="Buscar habilidades..." 
            onChange={(e) => onSearch(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button ref={searchBtnRef} className="search-btn">🔍</button>
        </div>
      ) : (
        <div className="top-title">
          {titleView === 'incomingMatchesView' ? 'Intereses recibidos' :
           titleView === 'historyView' ? 'Historial' :
           titleView === 'chatView' ? 'Mensajes' :
           titleView === 'profileView' ? 'Mi Perfil' :
           titleView === 'myMatchesView' ? 'Mis Matches' : 'Dashboard'}
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