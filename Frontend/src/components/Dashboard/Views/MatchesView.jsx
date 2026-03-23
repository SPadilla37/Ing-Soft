import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import MarketplaceCard from '../MarketplaceCard';
import PublicProfileModal from '../PublicProfileModal';

const MatchesView = ({ searchQuery }) => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [loading, setLoading] = useState(true);
  const [profileUserId, setProfileUserId] = useState(null);
  const [popup, setPopup] = useState('');

  const loadMarketplace = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ viewer_user_id: currentUser });
      if (searchQuery) queryParams.append('q', searchQuery);
      const result = await apiRequest(API_BASE, `/marketplace/habilidades?${queryParams}`);
      setRequests(result.users || []);
    } catch (error) {
      console.error('Error loading marketplace:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplace();
  }, [currentUser, searchQuery]);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const result = await apiRequest(API_BASE, '/habilidades');
        const habilidades = Array.isArray(result?.habilidades) ? result.habilidades : [];
        const uniqueCategories = new Set();

        habilidades.forEach((hab) => {
          const categoria = typeof hab?.categoria === 'string' ? hab.categoria.trim() : '';
          if (categoria) uniqueCategories.add(categoria);
        });

        const ordered = ['All', ...Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b))];
        if (active) setCategories(ordered);
      } catch (error) {
        console.error('Error loading categories:', error);
        if (active) setCategories(['All']);
      }
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  const handleAccept = async (user) => {
    const matchState = user.viewer_match_state || 'none';
    
    if (matchState === 'matched' && user.viewer_conversation_id) {
      setPopup('Ya puedes abrir el chat con este usuario.');
      return;
    }
    
    if (matchState === 'sent') {
      setPopup('Ya enviaste interés a este usuario. Espera su respuesta.');
      return;
    }
    
    if (matchState === 'received') {
      setPopup('Este usuario te envió una solicitud. Ve a "Intereses recibidos" para aceptar.');
      return;
    }
    
    try {
      const habilidadQueBusco = user.habilidades_ofertadas?.[0]?.id;
      const habilidadQueOfrezco = user.habilidades_buscadas?.[0]?.id;
      
      const result = await apiRequest(API_BASE, '/message-requests', {
        method: 'POST',
        body: JSON.stringify({
          from_user_id: Number(currentUser),
          to_user_id: user.id,
          habilidad_id: habilidadQueOfrezco,
          habilidad_solicitada_id: habilidadQueBusco,
          mensaje: 'Me interesa tu intercambio'
        })
      });
      
      loadMarketplace();
      
      if (result.matched && result.conversation_id) {
        setPopup('¡Hubo match mutuo! Ya puedes abrir el chat.');
      } else {
        setPopup('Interés enviado correctamente. Te avisaremos cuando te acepten.');
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchState = req.viewer_match_state || 'none';
    if (matchState === 'matched' && req.viewer_conversation_id) return false;
    if (selectedCategory === 'All') return true;

    const offeredCategory = req.habilidades_ofertadas?.[0]?.categoria || '';
    const requestedCategory = req.habilidades_buscadas?.[0]?.categoria || '';
    return offeredCategory === selectedCategory || requestedCategory === selectedCategory;
  });

  return (
    <section id="matchesView" className="view active">
      <div className="hero-strip">
        <h2>People matching your skill exchange</h2>
        <p>Estas son las solicitudes activas del marketplace. Usa el buscador y los filtros para encontrar un intercambio y aceptar si te interesa.</p>
        <div className="chip-row" style={{ marginTop: '0.9rem' }}>
          {categories.map(cat => (
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
