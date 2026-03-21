import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MatchesView from './Views/MatchesView';
import IncomingMatchesView from './Views/IncomingMatchesView';
import MyMatchesView from './Views/MyMatchesView';
import PublishView from './Views/PublishView';
import ChatView from './Views/ChatView';
import ProfileView from './Views/ProfileView';

const Dashboard = () => {
  const [activeView, setActiveView] = useState('matchesView');
  const [searchQuery, setSearchQuery] = useState('');
  const [badges, setBadges] = useState({
    matches: 0,
    incoming: 0,
    myMatches: 0,
    chat: 0
  });

  const renderView = () => {
    switch (activeView) {
      case 'matchesView':
        return <MatchesView searchQuery={searchQuery} />;
      case 'incomingMatchesView':
        return <IncomingMatchesView />;
      case 'myMatchesView':
        return <MyMatchesView />;
      case 'publishView':
        return <PublishView />;
      case 'chatView':
        return <ChatView />;
      case 'profileView':
        return <ProfileView />;
      default:
        return <MatchesView searchQuery={searchQuery} />;
    }
  };

  return (
    <div id="dashboard" className="dashboard">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        badges={badges}
      />
      <main className="main-shell">
        <TopBar onSearch={setSearchQuery} />
        {renderView()}
      </main>
    </div>
  );
};

export default Dashboard;
