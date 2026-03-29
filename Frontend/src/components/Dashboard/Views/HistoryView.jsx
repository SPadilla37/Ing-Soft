import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';

const HistoryView = () => {
  const { currentUser } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCompletedMatches = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [result, profileResult] = await Promise.all([
        apiRequest(API_BASE, `/matches/${encodeURIComponent(currentUser)}`),
        apiRequest(API_BASE, `/usuarios/${currentUser}`)
      ]);
      const myProfile = profileResult.user || profileResult;
      
      const completedMatches = (result.matches || []).filter(m => m.estado === 'completado' && m.my_reseña);

      const matchesWithDetails = await Promise.all(
        completedMatches.map(async (match) => {
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
      console.error('Error loading completed matches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompletedMatches();
  }, [currentUser]);

  const getInitials = (name) => {
    if (!name) return 'M';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-tertiary/20 via-surface-container-high/60 to-surface-container/40 backdrop-blur-sm rounded-2xl p-8 border border-tertiary/10">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-tertiary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-tertiary text-3xl">history</span>
          </div>
          <div>
            <h2 className="font-headline font-bold text-3xl text-on-surface">Historial de matches</h2>
            <p className="text-on-surface-variant mt-1">
              Aquí aparecen los matches que ya han sido completados.
            </p>
          </div>
        </div>
        
        {matches.length > 0 && (
          <div className="flex items-center gap-2 mt-4 text-on-surface-variant">
            <span className="material-symbols-outlined text-xl">task_alt</span>
            <span className="font-semibold">{matches.length} {matches.length === 1 ? 'match completado' : 'matches completados'}</span>
          </div>
        )}
      </div>

      {/* History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-tertiary/30 border-t-tertiary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-on-surface-variant">Cargando historial...</p>
            </div>
          </div>
        ) : matches.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-8xl text-on-surface-variant/20 mb-4">history_toggle_off</span>
            <p className="text-on-surface-variant text-lg">No tienes matches completados aún</p>
            <p className="text-on-surface-variant/70 text-sm mt-2">Cuando completes un intercambio, aparecerá aquí</p>
          </div>
        ) : (
          matches.map(match => (
            <div key={match.id} className="bg-surface-container-highest p-6 rounded-2xl border border-outline-variant/10 space-y-4">
              {/* Match Header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-tertiary to-tertiary-dim flex items-center justify-center text-white font-bold text-xl">
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
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-tertiary/20 text-tertiary">
                      {match.estado}
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

              {/* Rating Display */}
              {match.my_reseña && (
                <div className="bg-surface-container-low/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-on-surface">Tu calificación:</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span 
                          key={i} 
                          className={`material-symbols-outlined text-lg ${
                            i < match.my_reseña.calificacion ? 'text-secondary' : 'text-on-surface-variant/30'
                          }`}
                          style={{fontVariationSettings: i < match.my_reseña.calificacion ? "'FILL' 1" : "'FILL' 0"}}
                        >
                          star
                        </span>
                      ))}
                    </div>
                  </div>
                  {match.my_reseña.comentario && (
                    <div className="text-on-surface-variant text-sm">
                      <span className="font-semibold">Comentario:</span> {match.my_reseña.comentario}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default HistoryView;
