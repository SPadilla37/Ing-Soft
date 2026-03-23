import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';

const MyMatchesView = ({ onOpenChat = () => {} }) => {
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
      const result = await apiRequest(API_BASE, `/matches/${encodeURIComponent(currentUser)}`);
      setMatches(result.matches || []);
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
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRate = async (matchId) => {
    const rating = Number(ratingByMatch[matchId] || 0);
    if (rating < 1 || rating > 5) {
      alert('Selecciona una calificacion de 1 a 5 estrellas.');
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

  return (
    <section id="myMatchesView" className="view active">
      <div className="incoming-shell">
        <h2>Mis matches</h2>
        <p>Consulta el estado de cada match. Puedes finalizarlo y, cuando ambos lo finalicen, calificar.</p>
      </div>

      <div className="cards-grid">
        {loading ? <p>Cargando...</p> : 
         matches.length === 0 ? <p>Aún no tienes matches mutuos.</p> :
         matches.map(match => (
           <article key={match.id} className="match-card">
             <div className="match-head">
               <div className="match-avatar">M</div>
               <div>
                 <h3>{match.other_user_name || match.other_user_id}</h3>
                 <div className="muted">Estado: {match.estado || 'pendiente'}</div>
               </div>
             </div>
             <div>
               <div className="muted">Intercambio</div>
               <div className="strong-list">
                 {(match.habilidad?.nombre || 'Sin habilidad')} ↔ {(match.habilidad_solicitada?.nombre || 'Sin habilidad')}
               </div>
             </div>
             <div className="card-actions">
               {match.conversation_id && (
                 <button className="secondary-btn" onClick={() => onOpenChat(match.conversation_id)}>Abrir chat</button>
               )}
               {(match.estado === 'aceptado' || match.can_finalize) && (
                 <button 
                   className={match.can_finalize ? "primary-btn" : "secondary-btn"}
                   onClick={() => match.can_finalize && handleFinalize(match.id)}
                   disabled={!match.can_finalize}
                 >
                   {match.can_finalize ? "Finalizar match" : "Esperando al otro"}
                 </button>
               )}
             </div>

              {match.can_rate && (
                <div className="rating-box">
                  <div className="muted">Califica este intercambio</div>
                  <div className="stars-row">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star-btn ${(ratingByMatch[match.id] || 0) >= star ? 'active' : ''}`}
                        onClick={() => setRatingByMatch((prev) => ({ ...prev, [match.id]: star }))}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Comentario opcional"
                    value={commentByMatch[match.id] || ''}
                    onChange={(e) => setCommentByMatch((prev) => ({ ...prev, [match.id]: e.target.value }))}
                  />
                  <button
                    className="primary-btn"
                    onClick={() => handleRate(match.id)}
                    disabled={Boolean(ratingBusy[match.id])}
                  >
                    {ratingBusy[match.id] ? 'Enviando...' : 'Enviar calificacion'}
                  </button>
                </div>
              )}

              {!match.can_rate && match.my_reseña && (
                <div className="muted">Ya calificaste con {match.my_reseña.calificacion} estrella(s).</div>
              )}
           </article>
         ))
        }
      </div>
    </section>
  );
};

export default MyMatchesView;
