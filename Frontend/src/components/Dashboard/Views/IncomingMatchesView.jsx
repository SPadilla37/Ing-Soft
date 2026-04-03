import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import MarketplaceCard from '../MarketplaceCard';
import PublicProfileModal from '../PublicProfileModal';

const IncomingMatchesView = ({ onBadgeUpdate }) => {
  const { currentUser, getToken, dbUser } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [popup, setPopup] = useState('');
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  const loadIncoming = async () => {
    if (!dbUser?.id) return;
    setLoading(true);
    try {
      const userId = dbUser.id;
      const token = await getToken();
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      const [result, profileResult] = await Promise.all([
        apiRequest(API_BASE, `/matches/${encodeURIComponent(userId)}/incoming`, authHeaders),
        apiRequest(API_BASE, `/usuarios/${userId}`, authHeaders)
      ]);
      setCurrentUserProfile(profileResult.user || profileResult);
      let incoming = result.incoming || [];
      incoming = await Promise.all(incoming.map(async (u) => {
        if (!u.username && u.id) {
          try {
            const userRes = await apiRequest(API_BASE, `/usuarios/${u.id}`, authHeaders);
            return { ...u, username: userRes.user?.username || userRes.username };
          } catch {
            return u;
          }
        }
        return u;
      }));
      setItems(incoming);
    } catch (error) {
      console.error('Error loading incoming matches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncoming();
  }, [dbUser]);

  const handleAccept = async (requestId) => {
    try {
      const token = await getToken();
      await apiRequest(API_BASE, `/message-requests/${requestId}/respond`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: dbUser.id, action: 'accept' })
      });
      setPopup('Interés aceptado. Si ambos se aceptaron, ya tienen chat disponible.');
      loadIncoming();
      if (onBadgeUpdate) onBadgeUpdate();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleReject = async (requestId) => {
    try {
      const token = await getToken();
      await apiRequest(API_BASE, `/message-requests/${requestId}/respond`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: dbUser.id, action: 'reject' })
      });
      setPopup('Solicitud rechazada.');
      loadIncoming();
      if (onBadgeUpdate) onBadgeUpdate();
    } catch (error) {
      alert(error.message);
    }
  };

  const getMatchDetails = (req) => {
    if (!currentUserProfile) return { iOfferTheyWant: [], theyOfferIWant: [] };
    
    const myOfferedIds = new Set(currentUserProfile.habilidades_ofertadas?.map(h => h.id) || []);
    const mySoughtIds = new Set(currentUserProfile.habilidades_buscadas?.map(h => h.id) || []);
    
    return {
      iOfferTheyWant: (req.habilidades_buscadas || []).filter(h => myOfferedIds.has(h.id)),
      theyOfferIWant: (req.habilidades_ofertadas || []).filter(h => mySoughtIds.has(h.id))
    };
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
         items.map(item => {
            const matchDetails = getMatchDetails(item);
            // MarketplaceCard ya muestra username como principal tras el cambio global
            return (
              <MarketplaceCard 
                key={item.id}
                request={{ ...item, viewer_match_state: item.viewer_match_state || 'received' }}
                matchDetails={matchDetails}
                onAccept={() => handleAccept(item.id)}
                onReject={() => handleReject(item.id)}
                onProfile={() => setSelectedUser(item)}
              />
            );
          })
        }
      </div>

      {selectedUser && (
        <PublicProfileModal
          userId={selectedUser.id || selectedUser.usuario_emisor_id}
          userData={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {popup ? (
        <section className="auth-modal" onClick={() => setPopup('')}>
          <div className="modal-card glass" onClick={(e) => e.stopPropagation()}>
            <h2>Notificación</h2>
            <p>{popup}</p>
            <button className="primary-btn" onClick={() => setPopup('')}>Aceptar</button>
          </div>
        </section>
      ) : null}
    </section>
  );
};

export default IncomingMatchesView;
