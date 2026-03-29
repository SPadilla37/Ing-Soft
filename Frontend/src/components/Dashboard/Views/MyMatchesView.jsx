import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';

const MyMatchesView = ({ onOpenChat = () => {}, onBadgeUpdate }) => {
  const { currentUser } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingByMatch, setRatingByMatch] = useState({});
  const [commentByMatch, setCommentByMatch] = useState({});
  const [ratingBusy, setRatingBusy] = useState({});

  const loadMyMatches = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [result, profileResult] = await Promise.all([
        apiRequest(API_BASE, `/matches/${encodeURIComponent(currentUser)}`),
        apiRequest(API_BASE, `/usuarios/${currentUser}`)
      ]);
      const myProfile = profileResult.user || profileResult;
      const loadedMatches = result.matches || [];

      const matchesWithDetails = await Promise.all(
        loadedMatches.map(async (match) => {
          try {
            const otherProfileRes = await apiRequest(API_BASE, `/usuarios/${match.other_user_id}`);
            const otherProfile = otherProfileRes.user || otherProfileRes;
            const myOfferedIds = new Set(myProfile.habilidades_ofertadas?.map(h => h.id) || []);
            const mySoughtIds = new Set(myProfile.habilidades_buscadas?.map(h => h.id) || []);
            const iOfferTheyWant = (otherProfile.habilidades_buscadas || []).filter(h => myOfferedIds.has(h.id));
            const theyOfferIWant = (otherProfile.habilidades_ofertadas || []).filter(h => mySoughtIds.has(h.id));
            return {
              ...match,
              other_user_username: otherProfile.username,
              intersectIOfferTheyWant: iOfferTheyWant.length > 0 ? iOfferTheyWant : [match.habilidad_solicitada].filter(Boolean),
              intersectTheyOfferIWant: theyOfferIWant.length > 0 ? theyOfferIWant : [match.habilidad].filter(Boolean)
            };
          } catch (err) {
            console.error('Failed to augment match skills', err);
            return {
              ...match,
              intersectIOfferTheyWant: [match.habilidad_solicitada].filter(Boolean),
              intersectTheyOfferIWant: [match.habilidad].filter(Boolean)
            };
          }
        })
      );

      setMatches(matchesWithDetails);
    } catch (error) {
      console.error('Error loading my matches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyMatches();
  }, [currentUser]);

  const handleFinalize = async (matchId) => {
    try {
      await apiRequest(API_BASE, `/matches/${encodeURIComponent(matchId)}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ user_id: Number(currentUser) })
      });
      loadMyMatches();
      if (onBadgeUpdate) onBadgeUpdate();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRate = async (matchId) => {
    const rating = Number(ratingByMatch[matchId] || 0);
    if (rating < 1 || rating > 5) {
      alert('Selecciona una calificación de 1 a 5 estrellas.');
      return;
    }

    setRatingBusy((prev) => ({ ...prev, [matchId]: true }));
    try {
      await apiRequest(API_BASE, `/matches/${encodeURIComponent(matchId)}/rate`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: Number(currentUser),
          rating,
          comentario: commentByMatch[matchId] || '',
        }),
      });
      loadMyMatches();
    } catch (error) {
      alert(error.message);
    } finally {
      setRatingBusy((prev) => ({ ...prev, [matchId]: false }));
    }
  };

  const getInitials = (name) => {
    if (!name) return 'M';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const activeMatches = matches.filter(m => !m.my_reseña);

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/20 via-surface-container-high/60 to-surface-container/40 backdrop-blur-sm rounded-2xl p-8 border border-primary/10">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-3xl">handshake</span>
          </div>
          <div>
            <h2 className="font-headline font-bold text-3xl text-on-surface">Mis matches</h2>
            <p className="text-on-surface-variant mt-1">
              Consulta el estado de cada match. Puedes finalizarlo y, cuando ambos lo finalicen, calificar.
            </p>
          </div>
        </div>
        
        {activeMatches.length > 0 && (
          <div className="flex items-center gap-2 mt-4 text-on-surface-variant">
            <span className="material-symbols-outlined text-xl">check_circle</span>
            <span className="font-semibold">{activeMatches.length} {activeMatches.length === 1 ? 'match activo' : 'matches activos'}</span>
          </div>
        )}
      </div>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-on-surface-variant">Cargando matches...</p>
            </div>
          </div>
        ) : activeMatches.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-8xl text-on-surface-variant/20 mb-4">group_off</span>
            <p className="text-on-surface-variant text-lg">Aún no tienes matches mutuos</p>
            <p className="text-on-surface-variant/70 text-sm mt-2">Cuando alguien acepte tu solicitud, aparecerá aquí</p>
          </div>
        ) : (
          activeMatches.map(match => (
            <div key={match.id} className="bg-surface-container-highest p-6 rounded-2xl border border-outline-variant/10 space-y-4">
              {/* Match Header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-dim to-primary flex items-center justify-center text-white font-bold text-xl">
                  {getInitials(match.other_user_name)}
                </div>
                <div className="flex-1">
                  <h3 className="font-headline font-bold text-lg text-on-surface">
                    {match.other_user_username ? `@${match.other_user_username}` : match.other_user_name || `Usuario ${match.other_user_id}`}
                  </h3>
                  {match.other_user_name && match.other_user_username && (
                    <p className="text-on-surface-variant text-sm">{match.other_user_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      match.estado === 'aceptado' ? 'bg-secondary/20 text-secondary' : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      {match.estado || 'pendiente'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Skills Exchange */}
              <div className="bg-surface-container-low/50 rounded-xl p-4">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Intercambio</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-secondary-fixed font-medium">
                    {match.intersectTheyOfferIWant?.map(s => s.nombre).join(', ') || 'Sin habilidad'}
                  </span>
                  <span className="material-symbols-outlined text-on-surface-variant">swap_horiz</span>
                  <span className="text-tertiary-fixed font-medium">
                    {match.intersectIOfferTheyWant?.map(s => s.nombre).join(', ') || 'Sin habilidad'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {match.conversation_id && match.can_chat && (
                  <button 
                    className="w-full bg-secondary hover:bg-secondary-dim text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    onClick={() => onOpenChat(match.conversation_id)}
                  >
                    <span className="material-symbols-outlined">chat</span>
                    Abrir chat
                  </button>
                )}
                {(match.estado === 'aceptado' || match.can_finalize) && (
                  <button 
                    className={`w-full py-3 rounded-xl font-semibold transition-all ${
                      match.can_finalize
                        ? 'bg-primary-dim hover:bg-primary text-white'
                        : 'bg-surface-container text-on-surface-variant cursor-not-allowed'
                    }`}
                    onClick={() => match.can_finalize && handleFinalize(match.id)}
                    disabled={!match.can_finalize}
                  >
                    {match.can_finalize ? 'Finalizar match' : 'Esperando al otro'}
                  </button>
                )}
              </div>

              {/* Rating Section */}
              {match.can_rate && (
                <div className="bg-surface-container-low/50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-on-surface">Califica este intercambio</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`w-10 h-10 rounded-lg transition-all ${
                          (ratingByMatch[match.id] || 0) >= star
                            ? 'bg-secondary text-white scale-110'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                        onClick={() => setRatingByMatch((prev) => ({ ...prev, [match.id]: star }))}
                      >
                        <span className="material-symbols-outlined text-xl" style={{fontVariationSettings: (ratingByMatch[match.id] || 0) >= star ? "'FILL' 1" : "'FILL' 0"}}>
                          star
                        </span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Comentario opcional"
                    value={commentByMatch[match.id] || ''}
                    onChange={(e) => setCommentByMatch((prev) => ({ ...prev, [match.id]: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                    rows={3}
                  />
                  <button
                    className="w-full bg-primary-dim hover:bg-primary text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleRate(match.id)}
                    disabled={Boolean(ratingBusy[match.id])}
                  >
                    {ratingBusy[match.id] ? 'Enviando...' : 'Enviar calificación'}
                  </button>
                </div>
              )}

              {!match.can_rate && match.my_reseña && (
                <div className="text-on-surface-variant text-sm text-center py-2">
                  Ya calificaste con {match.my_reseña.calificacion} estrella(s).
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default MyMatchesView;
