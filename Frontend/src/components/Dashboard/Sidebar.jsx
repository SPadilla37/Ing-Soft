import React from 'react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ activeView, setActiveView, badges }) => {
  const { clearSession } = useAuth();

  const navItems = [
    { id: 'matchesView', label: 'Matches', icon: 'handshake' },
    { id: 'incomingMatchesView', label: 'Intereses', icon: 'auto_awesome', badgeKey: 'incoming' },
    { id: 'myMatchesView', label: 'Mis Matches', icon: 'favorite', badgeKey: 'myMatches' },
    { id: 'historyView', label: 'Historial', icon: 'history' },
    { id: 'chatView', label: 'Chat', icon: 'chat_bubble', badgeKey: 'chat' },
    { id: 'profileView', label: 'Perfil', icon: 'person' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 z-50 bg-[#091328] flex flex-col p-8 gap-y-4 font-label text-sm font-medium tracking-wide">
      <div className="mb-8">
        <h1 className="font-headline font-extrabold text-on-surface text-2xl">Habilio</h1>
        <p className="text-on-surface/40 text-xs mt-1">The Digital Atelier</p>
      </div>

      <nav className="flex flex-col gap-y-2 flex-grow">
        {navItems.map(item => (
          <button 
            key={item.id}
            className={`${
              activeView === item.id 
                ? 'bg-gradient-to-br from-primary-dim to-primary text-white rounded-full shadow-[0_0_20px_rgba(73,103,244,0.3)]' 
                : 'text-on-surface/50 hover:bg-surface-variant rounded-full hover:translate-x-1'
            } flex items-center gap-x-3 px-6 py-3.5 transition-all duration-200 relative`}
            onClick={() => setActiveView(item.id)}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
            {item.badgeKey && badges[item.badgeKey] > 0 && (
              <span className="absolute right-4 bg-error text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {badges[item.badgeKey]}
              </span>
            )}
          </button>
        ))}
      </nav>

      <button 
        className="bg-gradient-to-br from-primary-dim to-primary text-white font-bold py-4 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all mt-auto"
        onClick={() => setActiveView('matchesView')}
      >
        Create Exchange
      </button>
    </aside>
  );
};

export default Sidebar;
