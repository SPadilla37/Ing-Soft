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
      const result = await apiRequest(API_BASE, `/matches/${encodeURIComponent(currentUser)}`);
      // Filtrar solo los matches completados
      setMatches((result.matches || []).filter(m => m.estado === 'completado'));
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
                 <h3>{match.other_user_name || match.other_user_id}</h3>
                 <div className="muted">Estado: {match.estado}</div>
               </div>
             </div>
             <div>
               <div className="muted">Intercambio</div>
               <div className="strong-list">
                 {(match.habilidad?.nombre || 'Sin habilidad')} ↔ {(match.habilidad_solicitada?.nombre || 'Sin habilidad')}
               </div>
             </div>
           </article>
         ))
        }
      </div>
    </section>
  );
};

export default HistoryView;
