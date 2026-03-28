const ReviewCard = ({ review }) => {
  // Handle missing or invalid review data
  if (!review) {
    return null;
  }

  // Extract review data with fallbacks
  const rating = review.calificacion ?? 0;
  const comment = review.comentario || "Sin comentario";
  const authorName = review.autor?.nombre || '';
  const authorLastName = review.autor?.apellido || '';
  const fullName = [authorName, authorLastName].filter(Boolean).join(' ').trim() || 'Usuario eliminado';
  
  // Format date safely
  let formattedDate = '';
  try {
    if (review.created_at) {
      formattedDate = new Date(review.created_at).toLocaleDateString('es-ES');
    }
  } catch (e) {
    formattedDate = '';
  }

  return (
    <div className="review-card" style={{
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '12px'
    }}>
      <div className="review-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <span className="review-rating" style={{ color: '#f59e0b' }}>
          ★ {rating}/5
        </span>
        <span className="review-author" style={{ fontWeight: 500 }}>
          {fullName}
        </span>
        {formattedDate && (
          <span className="review-date" style={{ color: '#888', fontSize: '0.9em' }}>
            {formattedDate}
          </span>
        )}
      </div>
      <p className="review-comment" style={{ margin: 0, color: '#555' }}>
        {comment}
      </p>
    </div>
  );
};

export default ReviewCard;
