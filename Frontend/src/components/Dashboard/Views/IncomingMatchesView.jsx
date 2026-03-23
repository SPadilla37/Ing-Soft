import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import MarketplaceCard from '../MarketplaceCard';
import PublicProfileModal from '../PublicProfileModal';

const IncomingMatchesView = () => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileUserId, setProfileUserId] = useState(null);

  const loadIncoming = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const result = await apiRequest(API_BASE, `/matches/${encodeURIComponent(currentUser)}/incoming`);
      setItems(result.incoming || []);
    } catch (error) {
      console.error('Error loading incoming matches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncoming();
  }, [currentUser]);

  const handleAccept = async (requestId) => {
    try {
      await apiRequest(API_BASE, `/message-requests/${requestId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ user_id: Number(currentUser), action: 'accept' })
      });
      loadIncoming();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <section id="incomingMatchesView" className="view active">
      <div className="incoming-shell">
        <h2>Intereses recibidos</h2>
        <p>Aqui aparecen las personas que ya mostraron interes en ti. Si respondes, se crea el chat.</p>
      </div>

      <div className="cards-grid">
        {loading ? <p>Cargando...</p> : 
         items.length === 0 ? <p>Aún no recibes matches.</p> :
         items.map(item => (
           <MarketplaceCard 
             key={item.id}
             request={{ ...item, viewer_match_state: item.viewer_match_state || 'received' }}
             onAccept={() => handleAccept(item.id)}
             onProfile={(userId) => setProfileUserId(userId)}
           />
         ))
        }
      </div>

      {profileUserId ? (
        <PublicProfileModal
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
        />
      ) : null}
    </section>
  );
};

export default IncomingMatchesView;
