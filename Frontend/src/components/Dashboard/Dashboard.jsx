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
  const { currentUser, currentUserRecord } = useAuth();
  const [activeView, setActiveView] = useState('matchesView');
  const [chatConversationId, setChatConversationId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [badges, setBadges] = useState({
    incoming: 0,
    myMatches: 0,
    chat: 0
  });

  const loadBadges = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const userId = Number(currentUser);
      
      const [incomingResult, myMatchesResult, profileResult] = await Promise.all([
        apiRequest(API_BASE, `/matches/${encodeURIComponent(userId)}/incoming`),
        apiRequest(API_BASE, `/matches/${encodeURIComponent(userId)}`),
        apiRequest(API_BASE, `/usuarios/${encodeURIComponent(userId)}`)
      ]);

      const incomingCount = (incomingResult.incoming || []).length;
      
      const myMatchesCount = (myMatchesResult.matches || []).filter(
        m => m.estado === 'aceptado'
      ).length;

      let chatCount = 0;
      const profile = profileResult.user || profileResult;
      const ultimoLogin = profile.ultimo_login ? new Date(profile.ultimo_login) : null;

      if (ultimoLogin) {
        const conversationsResult = await apiRequest(API_BASE, `/conversations/${encodeURIComponent(userId)}`);
        const conversations = conversationsResult.conversations || [];
        
        for (const conv of conversations) {
          try {
            const messagesResult = await apiRequest(
              API_BASE, 
              `/conversations/${encodeURIComponent(conv.id)}/messages?viewer_user_id=${encodeURIComponent(userId)}`
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

  useEffect(() => {
    if (!currentUser) return;
    
    const userId = Number(currentUser);
    const eventSource = new EventSource(`${API_BASE}/notifications/stream/${userId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'badge_update') {
          // You can also increment specifically if data.target is provided,
          // but calling loadBadges() ensures exact sync with the server state.
          loadBadges();
        }
      } catch (e) {
        console.error('Error parsing SSE message:', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      // EventSource will automatically try to reconnect.
    };

    return () => {
      eventSource.close();
    };
  }, [currentUser, loadBadges]);

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
    <div className="bg-background min-h-screen">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        badges={badges}
      />
      <main className="ml-72 pt-32 px-10 pb-20">
        <TopBar onSearch={setSearchQuery} showSearch={activeView === 'matchesView'} />
        {renderView()}
      </main>
    </div>
  );
};

export default Dashboard;
