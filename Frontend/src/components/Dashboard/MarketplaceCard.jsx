import React from 'react';

const MarketplaceCard = ({ request, matchDetails, onAccept, onProfile, onReject }) => {
  const author = [request.nombre, request.apellido].filter(Boolean).join(' ').trim() || `Usuario ${request.id}`;
  const username = request.username ? `@${request.username}` : '';
  
  // Use intersected matches if available, otherwise just use the first skill defensively as fallback
  const offeredSkills = matchDetails?.theyOfferIWant?.length > 0 
    ? matchDetails.theyOfferIWant.map(s => s.nombre).join(', ')
    : (request.habilidades_ofertadas?.[0]?.nombre || 'Sin habilidad ofertada');
    
  const requestedSkills = matchDetails?.iOfferTheyWant?.length > 0
    ? matchDetails.iOfferTheyWant.map(s => s.nombre).join(', ')
    : (request.habilidades_buscadas?.[0]?.nombre || 'Sin habilidad solicitada');
    
  const introMessage = request.biografia || 'Sin descripción';
  const matchState = request.viewer_match_state || 'none';
  const rating = request.rating?.average;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <article className="match-card">
      <div className="match-head">
        <div className="match-avatar">{getInitials(author)}</div>
        <div>
          <h3 style={{marginBottom: 0}}>{username || author} {rating != null && <span className="rating-star">★ {Number(rating).toFixed(1)}</span>}</h3>
          {author && username && (
            <div style={{fontSize: '0.95em', color: '#888', marginBottom: 2}}>{author}</div>
          )}
          <div className="muted">Usuario compatible</div>
        </div>
      </div>
      <div>
        <div className="muted">Puedes aprender de {author}:</div>
        <div className="strong-list">{offeredSkills}</div>
      </div>
      <div>
        <div className="muted">{author} quiere aprender:</div>
        <div className="strong-list">{requestedSkills}</div>
      </div>
      <div>
        <div className="muted">Mensaje</div>
        <div>{introMessage}</div>
      </div>
      <div className="card-actions">
        <button 
          className={matchState === 'matched' ? 'secondary-btn' : 'primary-btn'}
          onClick={() => onAccept(request)}
          disabled={matchState === 'sent'}
        >
          {matchState === 'matched' ? 'Abrir chat' : 
           matchState === 'sent' ? 'Interes enviado' : 
           (matchState === 'received' || matchState === 'mutual-pending') ? 'Responder match' : 'Match'}
        </button>
        
        {(matchState === 'received' || matchState === 'mutual-pending') && onReject && (
          <button 
            className="danger-btn"
            onClick={() => onReject(request)}
          >
            Rechazar
          </button>
        )}
        
        <button className="ghost-btn" onClick={() => onProfile(request.id)}>
          Go to profile
        </button>
      </div>
    </article>
  );
};

export default MarketplaceCard;

