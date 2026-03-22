import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import { ensureSkillIds } from '../../../services/skills';

function parseSkillsInput(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const PublishView = () => {
  const { currentUser, currentUserRecord } = useAuth();
  const [formData, setFormData] = useState({
    offered_skill: '',
    requested_skill: '',
    mensaje: ''
  });
  const [ownRequests, setOwnRequests] = useState([]);
  const [status, setStatus] = useState('Aún no publicas una solicitud en esta sesión.');

  const loadOwnRequests = async () => {
    if (!currentUser) return;
    try {
      const result = await apiRequest(API_BASE, `/message-requests/${encodeURIComponent(currentUser)}/outgoing`);
      const list = Array.isArray(result.requests) ? result.requests : [];
      setOwnRequests(list.filter((r) => r.estado === 'pendiente' && r.usuario_receptor_id === 0));
    } catch (error) {
      console.error('Error loading own requests:', error);
    }
  };

  useEffect(() => {
    loadOwnRequests();
    if (currentUserRecord?.profile) {
      setFormData({
        offered_skill: currentUserRecord.profile.teachSkills?.join(', ') || '',
        requested_skill: currentUserRecord.profile.learnSkills?.join(', ') || '',
        mensaje: ''
      });
    }
  }, [currentUser, currentUserRecord]);

  const handlePublish = async () => {
    if (!formData.offered_skill || !formData.requested_skill) {
      alert('Debes indicar las habilidades.');
      return;
    }
    try {
      const offeredNames = parseSkillsInput(formData.offered_skill);
      const requestedNames = parseSkillsInput(formData.requested_skill);

      const offeredIds = await ensureSkillIds(API_BASE, offeredNames);
      const requestedIds = await ensureSkillIds(API_BASE, requestedNames);

      if (!offeredIds.length || !requestedIds.length) {
        setStatus('Error: No se pudieron resolver las habilidades seleccionadas.');
        return;
      }

      await apiRequest(API_BASE, '/message-requests', {
        method: 'POST',
        body: JSON.stringify({
          from_user_id: Number(currentUser),
          to_user_id: null,
          habilidad_id: offeredIds[0],
          habilidad_solicitada_id: requestedIds[0],
          mensaje: formData.mensaje || ''
        })
      });
      setStatus('Solicitud publicada correctamente.');
      loadOwnRequests();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const handleDelete = async (requestId) => {
    try {
      await apiRequest(API_BASE, `/message-requests/${encodeURIComponent(requestId)}?user_id=${encodeURIComponent(currentUser)}`, {
        method: 'DELETE'
      });
      loadOwnRequests();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <section id="publishView" className="view active">
      <div className="panel-grid">
        <div className="surface-card stack">
          <h2>Publica o actualiza tu intercambio</h2>
          <label>Habilidades que ofreces</label>
          <input 
            placeholder="Ej: Python, JavaScript" 
            value={formData.offered_skill}
            onChange={(e) => setFormData({...formData, offered_skill: e.target.value})}
          />
          <label>Habilidades que quieres aprender</label>
          <input 
            placeholder="Ej: Figma, Inglés" 
            value={formData.requested_skill}
            onChange={(e) => setFormData({...formData, requested_skill: e.target.value})}
          />
          <label>Mensaje para otros usuarios</label>
          <textarea 
            placeholder="Explica brevemente..." 
            value={formData.mensaje}
            onChange={(e) => setFormData({...formData, mensaje: e.target.value})}
          />
          <button className="primary-btn" onClick={handlePublish}>Publicar solicitud</button>
          <div className="muted">{status}</div>
        </div>

        <div className="surface-card stack">
          <h3>Mis solicitudes activas</h3>
          <div className="list">
            {ownRequests.map(req => (
              <div key={req.id} className="list-item">
                <strong>{req.habilidad?.nombre || 'Sin habilidad ofertada'}</strong>
                <div className="muted">Quiere aprender: {req.habilidad_solicitada?.nombre || 'Sin habilidad solicitada'}</div>
                <button className="mini-btn" onClick={() => handleDelete(req.id)}>Borrar</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PublishView;
