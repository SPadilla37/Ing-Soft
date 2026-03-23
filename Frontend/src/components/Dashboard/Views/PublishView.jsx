import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import { ensureSkillIds } from '../../../services/skills';
import SkillPicker from '../../Common/SkillPicker';

const PublishView = () => {
  const MAX_ACTIVE_PUBLICATIONS = 3;
  const { currentUser, currentUserRecord } = useAuth();
  const [formData, setFormData] = useState({
    offeredSkills: new Set(),
    requestedSkills: new Set(),
    mensaje: ''
  });
  const [ownRequests, setOwnRequests] = useState([]);
  const [status, setStatus] = useState('Aún no publicas una solicitud en esta sesión.');
  const [pickerConfig, setPickerConfig] = useState(null);
  const [popup, setPopup] = useState('');

  const loadOwnRequests = async () => {
    if (!currentUser) return;
    try {
      const result = await apiRequest(API_BASE, `/message-requests/${encodeURIComponent(currentUser)}/outgoing`);
      const list = Array.isArray(result.requests) ? result.requests : [];
      setOwnRequests(list.filter((r) => r.estado === 'pendiente' && r.usuario_receptor_id === r.usuario_emisor_id));
    } catch (error) {
      console.error('Error loading own requests:', error);
    }
  };

  useEffect(() => {
    loadOwnRequests();
    if (currentUserRecord?.profile) {
      setFormData({
        offeredSkills: new Set(currentUserRecord.profile.teachSkills || []),
        requestedSkills: new Set(currentUserRecord.profile.learnSkills || []),
        mensaje: ''
      });
    }
  }, [currentUser, currentUserRecord]);

  const handlePublish = async () => {
    if (!formData.offeredSkills.size || !formData.requestedSkills.size) {
      setPopup('Debes indicar las habilidades para ofrecer y aprender.');
      setStatus('Error: Debes indicar las habilidades para ofrecer y aprender.');
      return;
    }

    if (ownRequests.length >= MAX_ACTIVE_PUBLICATIONS) {
      const limitMessage = 'Ya alcanzaste el limite de 3 publicaciones activas. Borra una para publicar otra.';
      setStatus(`Error: ${limitMessage}`);
      setPopup(limitMessage);
      return;
    }

    try {
      const offeredNames = Array.from(formData.offeredSkills);
      const requestedNames = Array.from(formData.requestedSkills);

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
      setPopup('Tu solicitud se publicó exitosamente.');
      await loadOwnRequests();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      setPopup(error.message || 'No se pudo publicar la solicitud.');
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
          <p className="muted">Publicaciones activas: {ownRequests.length}/{MAX_ACTIVE_PUBLICATIONS}</p>
          <label>Habilidades que ofreces</label>
          <div className="summary-row">
            {Array.from(formData.offeredSkills).map((skill) => (
              <span key={`off-${skill}`} className="chip">{skill}</span>
            ))}
          </div>
          <button
            className="ghost-btn"
            onClick={() => setPickerConfig({ mode: 'teach', initial: formData.offeredSkills })}
          >
            Elegir habilidades para ofrecer
          </button>

          <label>Habilidades que quieres aprender</label>
          <div className="summary-row">
            {Array.from(formData.requestedSkills).map((skill) => (
              <span key={`req-${skill}`} className="chip">{skill}</span>
            ))}
          </div>
          <button
            className="ghost-btn"
            onClick={() => setPickerConfig({ mode: 'learn', initial: formData.requestedSkills })}
          >
            Elegir habilidades para aprender
          </button>

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

      {pickerConfig && (
        <SkillPicker
          mode={pickerConfig.mode}
          initialSelection={pickerConfig.initial}
          onSave={(selection) => {
            const field = pickerConfig.mode === 'teach' ? 'offeredSkills' : 'requestedSkills';
            setFormData((prev) => ({ ...prev, [field]: selection }));
            setPickerConfig(null);
          }}
          onCancel={() => setPickerConfig(null)}
        />
      )}

      {popup ? (
        <section className="auth-modal" onClick={() => setPopup('')}>
          <div className="modal-card glass" onClick={(e) => e.stopPropagation()}>
            <h2>Notificación</h2>
            <p>{popup}</p>
            <button className="primary-btn" onClick={() => setPopup('')}>Aceptar</button>
          </div>
        </section>
      ) : null}
    </section>
  );
};

export default PublishView;
