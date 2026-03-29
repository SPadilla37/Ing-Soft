import React from 'react';

const MarketplaceCard = ({ request, matchDetails, onAccept, onProfile, onReject }) => {
  const author = [request.nombre, request.apellido].filter(Boolean).join(' ').trim() || `Usuario ${request.id}`;
  const username = request.username ? `@${request.username}` : '';
  
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
    <div className="bg-surface-container-highest p-8 rounded-lg group hover:bg-surface-bright transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:bg-primary/10"></div>
      
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary/20 p-1 group-hover:border-primary/40 transition-colors bg-gradient-to-br from-primary-dim to-primary flex items-center justify-center text-white font-bold text-xl">
            {getInitials(author)}
          </div>
          <div>
            <h4 className="text-xl font-headline font-bold text-primary-fixed">{username || author}</h4>
            {rating != null && (
              <div className="flex items-center gap-1 text-secondary">
                <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                <span className="text-sm font-bold">{Number(rating).toFixed(1)}</span>
                <span className="text-on-surface-variant text-xs font-normal ml-1">(reviews)</span>
              </div>
            )}
          </div>
        </div>
        {matchState === 'matched' && (
          <span className="bg-surface-container-low text-on-surface-variant text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full">
            Match
          </span>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Puedes aprender
          </p>
          <div className="flex flex-wrap gap-2">
            {offeredSkills.split(', ').map((skill, idx) => (
              <span key={idx} className="px-4 py-1.5 rounded-full bg-secondary-container/30 text-secondary-fixed text-xs font-medium border border-secondary-container/20">
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> Quiere aprender
          </p>
          <div className="flex flex-wrap gap-2">
            {requestedSkills.split(', ').map((skill, idx) => (
              <span key={idx} className="px-4 py-1.5 rounded-full bg-tertiary-container/20 text-tertiary-fixed text-xs font-medium border border-tertiary-container/10">
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-outline-variant/10 flex items-center justify-between gap-2">
        <button 
          className="text-secondary text-sm font-bold hover:underline transition-all"
          onClick={() => onProfile(request.usuario_emisor_id || request.id)}
        >
          Ver perfil completo
        </button>
        <button 
          className={`${
            matchState === 'matched' 
              ? 'bg-secondary hover:bg-secondary-dim' 
              : 'bg-primary-dim hover:bg-primary'
          } text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={() => onAccept(request)}
          disabled={matchState === 'sent'}
        >
          {matchState === 'matched' ? 'Abrir chat' : 
           matchState === 'sent' ? 'Interes enviado' : 
           (matchState === 'received' || matchState === 'mutual-pending') ? 'Responder match' : 'Conectar'}
        </button>
      </div>
    </div>
  );
};

export default MarketplaceCard;

