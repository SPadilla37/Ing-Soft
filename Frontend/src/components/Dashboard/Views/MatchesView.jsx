import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE, skillsCatalog } from '../../../config/constants';
import MarketplaceCard from '../MarketplaceCard';
import PublicProfileModal from '../PublicProfileModal';

const MatchesView = ({ searchQuery }) => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [profileUserId, setProfileUserId] = useState(null);
  const [popup, setPopup] = useState('');

  const loadMarketplace = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ viewer_user_id: currentUser });
      if (searchQuery) params.append('q', searchQuery);
      const result = await apiRequest(API_BASE, `/marketplace/requests?${params.toString()}`);
      setRequests(result.requests);
    } catch (error) {
      console.error('Error loading marketplace:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplace();
  }, [currentUser, searchQuery]);

  const handleAccept = async (request) => {
    try {
      const result = await apiRequest(API_BASE, `/marketplace/requests/${request.id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ viewer_user_id: currentUser })
      });
      loadMarketplace();
      if (result.matched && result.conversation_id) {
        setPopup('¡Match aceptado por ambos! Ya puedes abrir el chat.');
      } else {
        setPopup('Interés enviado correctamente. Si la otra persona acepta, se abrirá el chat.');
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchState = req.viewer_match_state || 'none';
    if (matchState === 'matched' && req.viewer_conversation_id) return false;
    if (selectedCategory === 'All') return true;
      const offered = req.habilidad?.nombre || '';
      const requested = req.habilidad_solicitada?.nombre || '';
      return offered.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        requested.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  return (
    <section id="matchesView" className="view active">
      <div className="hero-strip">
        <h2>People matching your skill exchange</h2>
        <p>Estas son las solicitudes activas del marketplace. Usa el buscador y los filtros para encontrar un intercambio y aceptar si te interesa.</p>
        <div className="chip-row" style={{ marginTop: '0.9rem' }}>
          {Object.keys(skillsCatalog).map(cat => (
            <button 
              key={cat} 
              className={`chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <span className="muted">Solicitudes activas</span>
          <strong>{filteredRequests.length}</strong>
        </div>
        <div className="stat-box">
          <span className="muted">Tus conversaciones</span>
          <strong>0</strong> {/* Should come from dashboard state later */}
        </div>
      </div>

      <div className="cards-grid">
        {loading ? <p>Cargando matches...</p> : 
         filteredRequests.length === 0 ? <p>No se encontraron resultados.</p> :
         filteredRequests.map(req => (
           <MarketplaceCard 
             key={req.id} 
             request={req} 
             onAccept={handleAccept}
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

export default MatchesView;
