import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';

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
      setOwnRequests(result.requests.filter(r => r.status === 'pending' && r.to_user_id === '__PUBLIC__'));
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
      await apiRequest(API_BASE, '/message-requests', {
        method: 'POST',
        body: JSON.stringify({
          from_user_id: currentUser,
          to_user_id: null,
          ...formData
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
                <strong>{req.offered_skill}</strong>
                <div className="muted">Quiere aprender: {req.requested_skill}</div>
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
