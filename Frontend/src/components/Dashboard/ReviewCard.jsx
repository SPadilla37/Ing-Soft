const ReviewCard = ({ review }) => {
  if (!review) {
    return null;
  }

  const rating = review.calificacion ?? 0;
  const comment = review.comentario || "Sin comentario";
  const authorName = review.autor?.nombre || '';
  const authorLastName = review.autor?.apellido || '';
  const fullName = [authorName, authorLastName].filter(Boolean).join(' ').trim() || 'Usuario eliminado';
  
  let formattedDate = '';
  try {
    if (review.created_at) {
      formattedDate = new Date(review.created_at).toLocaleDateString('es-ES');
    }
  } catch (e) {
    formattedDate = '';
  }

  return (
    <div className="bg-surface-container-low/50 rounded-xl p-5 border border-outline-variant/10">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary-dim flex items-center justify-center text-white font-bold text-sm">
            {fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
          </div>
          <div>
            <p className="font-semibold text-on-surface">{fullName}</p>
            {formattedDate && (
              <p className="text-xs text-on-surface-variant">{formattedDate}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <span 
              key={i} 
              className={`material-symbols-outlined text-lg ${
                i < rating ? 'text-secondary' : 'text-on-surface-variant/30'
              }`}
              style={{fontVariationSettings: i < rating ? "'FILL' 1" : "'FILL' 0"}}
            >
              star
            </span>
          ))}
        </div>
      </div>
      <p className="text-on-surface-variant text-sm leading-relaxed">{comment}</p>
    </div>
  );
};

export default ReviewCard;
