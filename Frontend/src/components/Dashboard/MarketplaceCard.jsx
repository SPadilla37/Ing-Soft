import React from 'react';

const MarketplaceCard = ({ request, onAccept, onProfile }) => {
  const author = request.from_user_name || request.from_user_id;
  const matchState = request.viewer_match_state || 'none';

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <article className="match-card">
      <div className="match-head">
        <div className="match-avatar">{getInitials(author)}</div>
        <div>
          <h3>{author}</h3>
          <div className="muted">Solicitud publica</div>
        </div>
      </div>
      <div>
        <div className="muted">Puedes aprender de {author}:</div>
        <div className="strong-list">{request.offered_skill}</div>
      </div>
      <div>
        <div className="muted">{author} quiere aprender:</div>
        <div className="strong-list">{request.requested_skill}</div>
      </div>
      <div>
        <div className="muted">Mensaje</div>
        <div>{request.intro_message || "Sin descripcion"}</div>
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
        <button className="ghost-btn" onClick={() => onProfile(request.from_user_id)}>
          Go to profile
        </button>
      </div>
    </article>
  );
};

export default MarketplaceCard;
