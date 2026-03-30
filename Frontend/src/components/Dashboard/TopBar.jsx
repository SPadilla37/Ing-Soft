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
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-18rem)] z-40 bg-background/80 backdrop-blur-xl flex justify-between items-center px-10 py-6">
      {showSearch && (
        <div className="flex items-center gap-6 flex-grow max-w-2xl">
          <div className="relative w-full group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary-dim group-focus-within:text-primary transition-colors">
              search
            </span>
            <input 
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-full py-3 pl-12 pr-6 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-on-surface placeholder:text-on-surface-variant/50"
              placeholder="Buscar habilidades, mentores o intereses..." 
              type="text"
              maxLength={30}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-6 ml-8">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface/70 hover:text-primary cursor-pointer transition-colors">
            account_circle
          </span>
          <button 
            className="material-symbols-outlined text-on-surface/70 hover:text-primary cursor-pointer transition-colors"
            onClick={clearSession}
          >
            logout
          </button>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border border-outline-variant/20 flex items-center justify-center font-bold text-on-surface">
          {getInitials(visibleName)}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
