import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import SkillPicker from '../Common/SkillPicker';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';
import { ensureSkillIds } from '../../services/skills';

const OnboardingModal = () => {
  const { currentUser, setCurrentUserRecord } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    teachSkills: new Set(),
    learnSkills: new Set()
  });
  const [pickerConfig, setPickerConfig] = useState(null);

  const handleComplete = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert('Completa nombre y apellido para continuar.');
      return;
    }

    if (!formData.teachSkills.size || !formData.learnSkills.size) {
      alert('Selecciona al menos una habilidad para ofrecer y una para aprender.');
      return;
    }

    try {
      const teachSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.teachSkills));
      const learnSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.learnSkills));

      if (!teachSkillIds.length || !learnSkillIds.length) {
        alert('No se pudieron resolver las habilidades seleccionadas. Intentalo de nuevo.');
        return;
      }

      const result = await apiRequest(API_BASE, `/usuarios/${encodeURIComponent(currentUser)}/profile`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: formData.firstName.trim(),
          apellido: formData.lastName.trim(),
          biografia: formData.bio,
          habilidades_ofertadas: teachSkillIds,
          habilidades_buscadas: learnSkillIds,
        })
      });
      
      setCurrentUserRecord(result.user);
      // Automatically publish first request
      await apiRequest(API_BASE, `/message-requests`, {
        method: 'POST',
        body: JSON.stringify({
          from_user_id: Number(currentUser),
          to_user_id: null,
          habilidad_id: teachSkillIds[0],
          habilidad_solicitada_id: learnSkillIds[0],
          mensaje: 'Hola! Estoy buscando un intercambio de habilidades.'
        })
      });

    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <section id="onboardingModal" className="auth-modal">
      <div className="modal-card glass">
        <h2>Completa tu perfil</h2>
        <p>Completa tu perfil inicial para entrar en el marketplace de intercambio.</p>

        <div className="field-grid">
          <div>
            <label>Nombre</label>
            <input 
              placeholder="Pedro"
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            />
          </div>
          <div>
            <label>Apellido</label>
            <input
              placeholder="González"
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            />
          </div>
          <div>
            <label>Bio corta</label>
            <textarea 
              placeholder="Cuéntale a otros que puedes ensenar y que quieres aprender..."
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
            />
          </div>
        </div>

        <div className="selector-row">
          <div className="select-card">
            <h3>Habilidades que quieres ofrecer</h3>
            <div className="summary-row">
              {Array.from(formData.teachSkills).map(s => <span key={s} className="chip">{s}</span>)}
            </div>
            <button className="ghost-btn" onClick={() => setPickerConfig({ mode: 'teach', initial: formData.teachSkills })}>
              Elegir habilidades para ofrecer
            </button>
          </div>

          <div className="select-card">
            <h3>Habilidades que quieres aprender</h3>
            <div className="summary-row">
              {Array.from(formData.learnSkills).map(s => <span key={s} className="chip">{s}</span>)}
            </div>
            <button className="ghost-btn" onClick={() => setPickerConfig({ mode: 'learn', initial: formData.learnSkills })}>
              Elegir habilidades para aprender
            </button>
          </div>
        </div>

        <button className="primary-btn" onClick={handleComplete}>Continuar</button>
      </div>

      {pickerConfig && (
        <SkillPicker 
          mode={pickerConfig.mode}
          initialSelection={pickerConfig.initial}
          onSave={(selection) => {
            const field = pickerConfig.mode === 'teach' ? 'teachSkills' : 'learnSkills';
            setFormData({ ...formData, [field]: selection });
            setPickerConfig(null);
          }}
          onCancel={() => setPickerConfig(null)}
        />
      )}
    </section>
  );
};

export default OnboardingModal;
