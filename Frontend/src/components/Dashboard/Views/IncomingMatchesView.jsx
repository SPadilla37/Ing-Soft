import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import MarketplaceCard from '../MarketplaceCard';
import PublicProfileModal from '../PublicProfileModal';

const IncomingMatchesView = ({ onBadgeUpdate }) => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileUserId, setProfileUserId] = useState(null);
  const [popup, setPopup] = useState('');
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  const loadIncoming = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [result, profileResult] = await Promise.all([
        apiRequest(API_BASE, `/matches/${encodeURIComponent(currentUser)}/incoming`),
        apiRequest(API_BASE, `/usuarios/${currentUser}`)
      ]);
      setCurrentUserProfile(profileResult.user || profileResult);
      let incoming = result.incoming || [];
      incoming = await Promise.all(incoming.map(async (u) => {
        if (!u.username && u.id) {
          try {
            const userRes = await apiRequest(API_BASE, `/usuarios/${u.id}`);
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
  }, [currentUser]);

  const handleAccept = async (requestId) => {
    try {
      await apiRequest(API_BASE, `/message-requests/${requestId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ user_id: Number(currentUser), action: 'accept' })
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
      await apiRequest(API_BASE, `/message-requests/${requestId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ user_id: Number(currentUser), action: 'reject' })
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
    <section className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-secondary/20 via-surface-container-high/60 to-surface-container/40 backdrop-blur-sm rounded-2xl p-8 border border-secondary/10">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-3xl">favorite</span>
          </div>
          <div>
            <h2 className="font-headline font-bold text-3xl text-on-surface">Intereses recibidos</h2>
            <p className="text-on-surface-variant mt-1">
              Aquí aparecen las personas que ya mostraron interés en ti. Si respondes, se crea el chat.
            </p>
          </div>
        </div>
        
        {items.length > 0 && (
          <div className="flex items-center gap-2 mt-4 text-on-surface-variant">
            <span className="material-symbols-outlined text-xl">notifications_active</span>
            <span className="font-semibold">{items.length} {items.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}</span>
          </div>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-on-surface-variant">Cargando solicitudes...</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-8xl text-on-surface-variant/20 mb-4">inbox</span>
            <p className="text-on-surface-variant text-lg">Aún no recibes matches</p>
            <p className="text-on-surface-variant/70 text-sm mt-2">Cuando alguien muestre interés en ti, aparecerá aquí</p>
          </div>
        ) : (
          items.map(item => {
            const matchDetails = getMatchDetails(item);
            return (
              <MarketplaceCard 
                key={item.id}
                request={{ ...item, viewer_match_state: item.viewer_match_state || 'received' }}
                matchDetails={matchDetails}
                onAccept={() => handleAccept(item.id)}
                onReject={() => handleReject(item.id)}
                onProfile={(userId) => setProfileUserId(userId)}
              />
            );
          })
        )}
      </div>

      {profileUserId && (
        <PublicProfileModal
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
        />
      )}

      {popup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPopup('')}>
          <div className="bg-surface-container-highest rounded-2xl p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-2xl">check_circle</span>
              </div>
              <h2 className="text-2xl font-headline font-bold text-on-surface">Notificación</h2>
            </div>
            <p className="text-on-surface-variant mb-6">{popup}</p>
            <button 
              className="w-full bg-primary-dim hover:bg-primary text-white py-3 rounded-full font-bold transition-all"
              onClick={() => setPopup('')}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default IncomingMatchesView;
