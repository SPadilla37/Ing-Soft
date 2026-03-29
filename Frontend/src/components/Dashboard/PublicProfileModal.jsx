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
      if (!userId) {
        setError('No se proporcionó un ID de usuario válido.');
        setLoading(false);
        return;
      }

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
        const [userResult, reviewsResult] = await Promise.allSettled([
          apiRequest(API_BASE, `/usuarios/${encodeURIComponent(userId)}`),
          apiRequest(API_BASE, `/usuarios/${encodeURIComponent(userId)}/reviews`)
        ]);

        if (!cancelled) {
          if (userResult.status === 'fulfilled') {
            if (userResult.value && typeof userResult.value === 'object') {
              setUser(userResult.value.user || null);
            } else {
              setError('Error al procesar los datos del perfil.');
            }
          } else {
            setError(userResult.reason?.message || 'No se pudo cargar el perfil.');
          }

          if (reviewsResult.status === 'fulfilled') {
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

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-surface-container-highest rounded-3xl border border-outline-variant/20 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-surface-container-highest border-b border-outline-variant/10 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">person</span>
            </div>
            <h2 className="font-headline font-bold text-2xl text-on-surface">Perfil público</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-center text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-on-surface-variant">Cargando perfil...</p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined text-6xl text-error/30 mb-4">error</span>
              <p className="text-error">{error}</p>
            </div>
          )}

          {!loading && !error && user && (
            <div className="space-y-8">
              {/* Profile Header */}
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-dim to-primary flex items-center justify-center text-white font-bold text-4xl shadow-lg flex-shrink-0">
                  {getInitials(fullName)}
                </div>
                <div className="flex-1">
                  <h3 className="font-headline font-bold text-3xl text-on-surface mb-2">{fullName}</h3>
                  {user.username && (
                    <p className="text-on-surface-variant text-lg mb-3">@{user.username}</p>
                  )}
                  <p className="text-on-surface-variant leading-relaxed">
                    {user.biografia || 'Sin biografía.'}
                  </p>
                </div>
              </div>

              {/* Rating */}
              <div className="bg-surface-container-low/50 rounded-xl p-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>
                    star
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Rating promedio</p>
                    <p className="text-2xl font-bold text-on-surface">
                      {user.rating?.average == null ? 'Sin calificaciones' : `${Number(user.rating.average).toFixed(1)} / 5`}
                      <span className="text-sm text-on-surface-variant font-normal ml-2">
                        ({user.rating?.count || 0} {user.rating?.count === 1 ? 'reseña' : 'reseñas'})
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-surface-container-low/50 rounded-xl p-6 border border-outline-variant/10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-secondary">school</span>
                    <h4 className="font-semibold text-on-surface">Habilidades que ofrece</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(user.habilidades_ofertadas || []).length === 0 ? (
                      <span className="text-on-surface-variant text-sm italic">Sin habilidades</span>
                    ) : (
                      (user.habilidades_ofertadas || []).map((item) => (
                        <span key={`of-${item.id}`} className="px-3 py-1.5 rounded-full bg-secondary-container/30 text-secondary-fixed text-xs font-medium border border-secondary-container/20">
                          {item.nombre}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-surface-container-low/50 rounded-xl p-6 border border-outline-variant/10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-tertiary">auto_awesome</span>
                    <h4 className="font-semibold text-on-surface">Habilidades que busca</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(user.habilidades_buscadas || []).length === 0 ? (
                      <span className="text-on-surface-variant text-sm italic">Sin habilidades</span>
                    ) : (
                      (user.habilidades_buscadas || []).map((item) => (
                        <span key={`bu-${item.id}`} className="px-3 py-1.5 rounded-full bg-tertiary-container/20 text-tertiary-fixed text-xs font-medium border border-tertiary-container/10">
                          {item.nombre}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Reviews Section */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-primary text-2xl">rate_review</span>
                  <h4 className="font-headline font-bold text-xl text-on-surface">
                    Reseñas recibidas ({reviews.length})
                  </h4>
                </div>
                
                {reviewsError && (
                  <div className="bg-error/10 border border-error/20 rounded-xl p-4 text-error text-sm">
                    {reviewsError}
                  </div>
                )}
                
                {!reviewsError && reviews.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">reviews</span>
                    <p className="text-on-surface-variant">Sin reseñas aún</p>
                  </div>
                )}
                
                {!reviewsError && reviews.length > 0 && (
                  <div className="space-y-4">
                    {reviews.map(review => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicProfileModal;