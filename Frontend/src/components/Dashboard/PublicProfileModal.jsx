import React, { useEffect, useState } from 'react';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';
import ReviewCard from './ReviewCard';

const PublicProfileModal = ({ userId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      // Validate userId prop before making requests
      if (!userId) {
        setError('No se proporcionó un ID de usuario válido.');
        setLoading(false);
        return;
      }

      // Validate userId is a positive integer
      const userIdNum = Number(userId);
      if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
        setError('ID de usuario inválido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setReviewsError('');

      try {
        // Parallel requests using Promise.allSettled
        const [userResult, reviewsResult] = await Promise.allSettled([
          apiRequest(API_BASE, `/usuarios/${encodeURIComponent(userId)}`),
          apiRequest(API_BASE, `/usuarios/${encodeURIComponent(userId)}/reviews`)
        ]);

        if (!cancelled) {
          // Handle user data result
          if (userResult.status === 'fulfilled') {
            // Validate response structure
            if (userResult.value && typeof userResult.value === 'object') {
              setUser(userResult.value.user || null);
            } else {
              setError('Error al procesar los datos del perfil.');
            }
          } else {
            setError(userResult.reason?.message || 'No se pudo cargar el perfil.');
          }

          // Handle reviews result (don't fail if reviews fail)
          if (reviewsResult.status === 'fulfilled') {
            // Validate response structure
            if (reviewsResult.value && typeof reviewsResult.value === 'object') {
              const reviewsData = reviewsResult.value.reviews;
              if (Array.isArray(reviewsData)) {
                setReviews(reviewsData);
              } else {
                setReviewsError('Error al procesar las reseñas.');
              }
            } else {
              setReviewsError('Error al procesar las reseñas.');
            }
          } else {
            setReviewsError('No se pudieron cargar las reseñas.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error al cargar los datos.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const fullName = user
    ? [user.nombre, user.apellido].filter(Boolean).join(' ').trim() || user.username || user.email || `Usuario ${user.id}`
    : '';

  return (
    <section className="auth-modal" onClick={onClose}>
      <div className="modal-card glass" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>Perfil publico</h2>
          <button className="mini-btn" onClick={onClose}>Cerrar</button>
        </div>

        {loading ? <p>Cargando perfil...</p> : null}
        {!loading && error ? <p>{error}</p> : null}

        {!loading && !error && user ? (
          <div className="profile-modal-content">
            <h3>{fullName}</h3>
            {user.username && <div className="profile-username">@{user.username}</div>}
            <p>{user.biografia || 'Sin biografia.'}</p>

            <div className="profile-modal-rating">
              <strong>Rating promedio:</strong>{' '}
              {user.rating?.average == null ? 'Sin calificaciones' : `${Number(user.rating.average).toFixed(1)} / 5`}
              {' '}({user.rating?.count || 0})
            </div>

            <div>
              <strong>Habilidades que ofrece</strong>
              <div className="summary-row" style={{ marginTop: '0.5rem' }}>
                {(user.habilidades_ofertadas || []).map((item) => (
                  <span key={`of-${item.id}`} className="chip">{item.nombre}</span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '0.8rem' }}>
              <strong>Habilidades que busca</strong>
              <div className="summary-row" style={{ marginTop: '0.5rem' }}>
                {(user.habilidades_buscadas || []).map((item) => (
                  <span key={`bu-${item.id}`} className="chip">{item.nombre}</span>
                ))}
              </div>
            </div>

            <div className="reviews-section" style={{ marginTop: '1.2rem' }}>
              <h4>Reseñas recibidas ({reviews.length})</h4>
              
              {reviewsError && (
                <p className="error-message">{reviewsError}</p>
              )}
              
              {!reviewsError && reviews.length === 0 && (
                <p className="muted">Sin reseñas aún</p>
              )}
              
              {!reviewsError && reviews.length > 0 && (
                <div className="reviews-list">
                  {reviews.map(review => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default PublicProfileModal;