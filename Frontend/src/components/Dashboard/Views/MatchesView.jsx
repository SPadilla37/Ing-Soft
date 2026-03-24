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
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  const loadMarketplace = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Fetch both the marketplace requests and the current user's profile in parallel
      const [marketResult, profileResult] = await Promise.all([
        apiRequest(API_BASE, `/marketplace/habilidades?viewer_user_id=${currentUser}${searchQuery ? `&q=${searchQuery}` : ''}`),
        apiRequest(API_BASE, `/usuarios/${currentUser}`)
      ]);

      setCurrentUserProfile(profileResult.user || profileResult);
      let users = marketResult.users || [];

      // Si falta username, hacer fetch adicional
      users = await Promise.all(users.map(async (u) => {
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
      setRequests(users);
    } catch (error) {
      console.error('Error loading marketplace data:', error);
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

  const handleAccept = async (user, matchDetails) => {
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
      // User the first matched skill for the official request creation
      const habilidadQueBusco = matchDetails.theyOfferIWant[0]?.id || user.habilidades_ofertadas?.[0]?.id;
      const habilidadQueOfrezco = matchDetails.iOfferTheyWant[0]?.id || user.habilidades_buscadas?.[0]?.id;
      
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

  const getMatchDetails = (req) => {
    if (!currentUserProfile) return { iOfferTheyWant: [], theyOfferIWant: [] };
    
    const myOfferedIds = new Set(currentUserProfile.habilidades_ofertadas?.map(h => h.id) || []);
    const mySoughtIds = new Set(currentUserProfile.habilidades_buscadas?.map(h => h.id) || []);
    
    return {
      // What I offer that they want (intersection of my offered and their sought)
      iOfferTheyWant: (req.habilidades_buscadas || []).filter(h => myOfferedIds.has(h.id)),
      // What they offer that I want (intersection of their offered and my sought)
      theyOfferIWant: (req.habilidades_ofertadas || []).filter(h => mySoughtIds.has(h.id))
    };
  };

  const filteredRequests = requests.filter(req => {
    const matchState = req.viewer_match_state || 'none';
    if (matchState === 'matched' && req.viewer_conversation_id) return false;
    if (selectedCategory === 'All') return true;

    const matchDetails = getMatchDetails(req);
    // Check if any of the matched skills belong to the selected category
    const hasCategoryMatch = [...matchDetails.iOfferTheyWant, ...matchDetails.theyOfferIWant]
      .some(h => h.categoria === selectedCategory);
      
    // Fallback exactly like old behavior if no profile (or no intersection due to some weird state)
    if (!hasCategoryMatch && matchDetails.iOfferTheyWant.length === 0 && matchDetails.theyOfferIWant.length === 0) {
      const offeredCategory = req.habilidades_ofertadas?.[0]?.categoria || '';
      const requestedCategory = req.habilidades_buscadas?.[0]?.categoria || '';
      return offeredCategory === selectedCategory || requestedCategory === selectedCategory;
    }
    
    return hasCategoryMatch;
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
         filteredRequests.map(req => {
           const matchDetails = getMatchDetails(req);
           return (
             <MarketplaceCard 
               key={req.id} 
               request={req} 
               matchDetails={matchDetails}
               onAccept={(user) => handleAccept(user, matchDetails)}
               onProfile={(userId) => setProfileUserId(userId)}
             />
           );
         })
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

