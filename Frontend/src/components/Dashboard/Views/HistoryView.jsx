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
      
      // Filtrar solo los matches completados Y calificados por el usuario
      const completedMatches = (result.matches || []).filter(m => m.estado === 'completado' && m.my_reseña);

      // Fetch the profiles for all matched users to calculate skill overlap in the frontend
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

  return (
    <section id="historyView" className="view active">
      <div className="incoming-shell">
        <h2>Historial de matches</h2>
        <p>Aquí aparecen los matches que ya han sido completados.</p>
      </div>
      <div className="cards-grid">
        {loading ? <p>Cargando...</p> :
         matches.length === 0 ? <p>No tienes matches completados aún.</p> :
         matches.map(match => (
           <article key={match.id} className="match-card">
             <div className="match-head">
               <div className="match-avatar">M</div>
               <div>
                <h3 style={{marginBottom: 0}}>{match.other_user_username ? `@${match.other_user_username}` : match.other_user_name || match.other_user_id}</h3>
                {match.other_user_name && match.other_user_username && (
                  <div style={{fontSize: '0.95em', color: '#888', marginBottom: 2}}>{match.other_user_name}</div>
                )}
                 <div className="muted">Estado: {match.estado}</div>
               </div>
             </div>
             <div>
               <div className="muted">Intercambio</div>
               <div className="strong-list">
                 {match.intersectTheyOfferIWant?.map(s => s.nombre).join(', ') || 'Sin habilidad'} ↔ {match.intersectIOfferTheyWant?.map(s => s.nombre).join(', ') || 'Sin habilidad'}
               </div>
             </div>
             {match.my_reseña && (
               <div className="muted" style={{ marginTop: '0.5rem' }}>
                 <strong>Tu calificación:</strong> {match.my_reseña.calificacion} estrella(s)
                 {match.my_reseña.comentario && (
                   <><br/><strong>Comentario:</strong> {match.my_reseña.comentario}</>
                 )}
               </div>
             )}
           </article>
         ))
        }
      </div>
    </section>
  );
};

export default HistoryView;
