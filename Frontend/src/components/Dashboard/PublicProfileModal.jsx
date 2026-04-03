import React, { useEffect, useState } from 'react';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';

const PublicProfileModal = ({ userId, onClose }) => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      if (!userId) return;
      setLoading(true);
      setError('');

      try {
        const token = await getToken();
        const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
        const result = await apiRequest(API_BASE, `/usuarios/${encodeURIComponent(userId)}`, authHeaders);
        if (!cancelled) {
          setUser(result.user || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'No se pudo cargar el perfil.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadUser();

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
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default PublicProfileModal;