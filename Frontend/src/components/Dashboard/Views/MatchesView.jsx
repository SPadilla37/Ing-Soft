import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import MarketplaceCard from '../MarketplaceCard';
import PublicProfileModal from '../PublicProfileModal';

const MatchesView = ({ searchQuery }) => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [categories, setCategories] = useState(['Todas']);
  const [loading, setLoading] = useState(true);
  const [profileUserId, setProfileUserId] = useState(null);
  const [popup, setPopup] = useState('');
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  const loadMarketplace = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [marketResult, profileResult] = await Promise.all([
        apiRequest(API_BASE, `/marketplace/habilidades?viewer_user_id=${currentUser}${searchQuery ? `&q=${searchQuery}` : ''}`),
        apiRequest(API_BASE, `/usuarios/${currentUser}`)
      ]);

      setCurrentUserProfile(profileResult.user || profileResult);
      let users = marketResult.users || [];

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

        const ordered = ['Todas', ...Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b))];
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
      iOfferTheyWant: (req.habilidades_buscadas || []).filter(h => myOfferedIds.has(h.id)),
      theyOfferIWant: (req.habilidades_ofertadas || []).filter(h => mySoughtIds.has(h.id))
    };
  };

  const filteredRequests = requests.filter(req => {
    const matchState = req.viewer_match_state || 'none';
    if (matchState === 'matched' && req.viewer_conversation_id) return false;
    if (selectedCategory === 'Todas') return true;

    const matchDetails = getMatchDetails(req);
    const hasCategoryMatch = [...matchDetails.iOfferTheyWant, ...matchDetails.theyOfferIWant]
      .some(h => h.categoria === selectedCategory);
      
    if (!hasCategoryMatch && matchDetails.iOfferTheyWant.length === 0 && matchDetails.theyOfferIWant.length === 0) {
      const offeredCategory = req.habilidades_ofertadas?.[0]?.categoria || '';
      const requestedCategory = req.habilidades_buscadas?.[0]?.categoria || '';
      return offeredCategory === selectedCategory || requestedCategory === selectedCategory;
    }
    
    return hasCategoryMatch;
  });

  return (
    <section className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-high p-8 rounded-lg flex items-center justify-between group hover:bg-surface-bright transition-all cursor-default">
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">Solicitudes activas</p>
            <h3 className="text-4xl font-headline font-extrabold text-on-surface">{filteredRequests.length}</h3>
          </div>
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-3xl">pending_actions</span>
          </div>
        </div>
        <div className="bg-surface-container-high p-8 rounded-lg flex items-center justify-between group hover:bg-surface-bright transition-all cursor-default">
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">Tus conversaciones</p>
            <h3 className="text-4xl font-headline font-extrabold text-on-surface">0</h3>
          </div>
          <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-3xl">chat_bubble</span>
          </div>
        </div>
        <div className="bg-surface-container-high p-8 rounded-lg flex items-center justify-between group hover:bg-surface-bright transition-all cursor-default">
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">Habilidades ganadas</p>
            <h3 className="text-4xl font-headline font-extrabold text-on-surface">0</h3>
          </div>
          <div className="w-14 h-14 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-3xl">school</span>
          </div>
        </div>
      </div>

      {/* Title and Filters */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-headline font-extrabold text-on-surface tracking-tight leading-none mb-4">
            Matches sugeridos
          </h2>
          <p className="text-on-surface-variant max-w-xl text-lg">
            Explora talentos curados específicamente para tu crecimiento mutuo en el Digital Atelier.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="p-3 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface">
            <span className="material-symbols-outlined">filter_list</span>
          </button>
          <button className="p-3 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface">
            <span className="material-symbols-outlined">sort</span>
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button 
            key={cat} 
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat 
                ? 'bg-primary text-white shadow-lg' 
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-bright'
            }`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Match Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          <p className="text-on-surface-variant">Cargando matches...</p>
        ) : filteredRequests.length === 0 ? (
          <p className="text-on-surface-variant">No se encontraron resultados.</p>
        ) : (
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
            <h2 className="text-2xl font-headline font-bold text-on-surface mb-4">Notificación</h2>
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

export default MatchesView;

