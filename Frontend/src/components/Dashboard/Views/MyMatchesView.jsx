import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';

const MyMatchesView = () => {
  const { currentUser } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

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
        body: JSON.stringify({ user_id: currentUser })
      });
      loadMyMatches();
    } catch (error) {
      alert(error.message);
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
                 <div className="muted">Estado: {match.status}</div>
               </div>
             </div>
             <div>
               <div className="muted">Intercambio</div>
               <div className="strong-list">{match.request?.offered_skill} ↔ {match.request?.requested_skill}</div>
             </div>
             <div className="card-actions">
               {match.conversation_id && (
                 <button className="secondary-btn">Abrir chat</button>
               )}
               {match.status === 'in_progress' && (
                 <button 
                   className={match.can_finalize ? "primary-btn" : "secondary-btn"}
                   onClick={() => match.can_finalize && handleFinalize(match.id)}
                   disabled={!match.can_finalize}
                 >
                   {match.can_finalize ? "Finalizar match" : "Esperando al otro"}
                 </button>
               )}
             </div>
           </article>
         ))
        }
      </div>
    </section>
  );
};

export default MyMatchesView;
