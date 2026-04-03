import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MatchesView from './Views/MatchesView';
import IncomingMatchesView from './Views/IncomingMatchesView';
import MyMatchesView from './Views/MyMatchesView';
import HistoryView from './Views/HistoryView';
import ChatView from './Views/ChatView';
import ProfileView from './Views/ProfileView';

const Dashboard = () => {
  const { currentUser, currentUserRecord, getToken, dbUser } = useAuth();
  const [activeView, setActiveView] = useState('matchesView');
  const [chatConversationId, setChatConversationId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [badges, setBadges] = useState({
    incoming: 0,
    myMatches: 0,
    chat: 0
  });

  const loadBadges = useCallback(async () => {
    if (!dbUser?.id) return;
    
    try {
      const userId = dbUser.id;
      const token = await getToken();
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      
      const [incomingResult, myMatchesResult, profileResult] = await Promise.all([
        apiRequest(API_BASE, `/matches/${encodeURIComponent(userId)}/incoming`, authHeaders),
        apiRequest(API_BASE, `/matches/${encodeURIComponent(userId)}`, authHeaders),
        apiRequest(API_BASE, `/usuarios/${encodeURIComponent(userId)}`, authHeaders)
      ]);

      const incomingCount = (incomingResult.incoming || []).length;
      
      const myMatchesCount = (myMatchesResult.matches || []).filter(
        m => m.estado === 'aceptado'
      ).length;

      let chatCount = 0;
      const profile = profileResult.user || profileResult;
      const ultimoLogin = profile.ultimo_login ? new Date(profile.ultimo_login) : null;

      if (ultimoLogin) {
        const conversationsResult = await apiRequest(API_BASE, `/conversations/${encodeURIComponent(userId)}`, authHeaders);
        const conversations = conversationsResult.conversations || [];
        
        for (const conv of conversations) {
          try {
            const messagesResult = await apiRequest(
              API_BASE, 
              `/conversations/${encodeURIComponent(conv.id)}/messages?viewer_user_id=${encodeURIComponent(userId)}`,
              authHeaders
            );
            const messages = messagesResult.messages || [];
            const unreadFromOther = messages.filter(m => 
              m.remitente_id !== userId && 
              new Date(m.enviado_at) > ultimoLogin
            );
            chatCount += unreadFromOther.length;
          } catch {
            // Skip conversation if fails
          }
        }
      }

      setBadges({
        incoming: incomingCount,
        myMatches: myMatchesCount,
        chat: chatCount
      });
    } catch (error) {
      console.error('Error loading badges:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  const handleBadgeUpdate = useCallback(() => {
    loadBadges();
  }, [loadBadges]);

  const renderView = () => {
    switch (activeView) {
      case 'matchesView':
        return <MatchesView searchQuery={searchQuery} />;
      case 'incomingMatchesView':
        return <IncomingMatchesView />;
      case 'myMatchesView':
        return (
          <MyMatchesView
            onOpenChat={(conversationId) => {
              setChatConversationId(conversationId);
              setActiveView('chatView');
            }}
          />
        );
      case 'historyView':
        return <HistoryView />;
      case 'chatView':
        return <ChatView initialConversationId={chatConversationId} />;
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
        <TopBar onSearch={setSearchQuery} showSearch={activeView === 'matchesView'} />
        {renderView()}
      </main>
    </div>
  );
};

export default Dashboard;
