import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import SkillPicker from '../Common/SkillPicker';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';

const OnboardingModal = () => {
  const { currentUser, setSession, setCurrentUserRecord } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    bio: '',
    teachSkills: new Set(),
    learnSkills: new Set(),
    languages: new Set()
  });
  const [pickerConfig, setPickerConfig] = useState(null);

  const handleComplete = async () => {
    if (!formData.teachSkills.size || !formData.learnSkills.size) {
      alert('Por favor selecciona al menos una habilidad para ofrecer y una para aprender.');
      return;
    }

    try {
      const profile = {
        fullName: formData.fullName,
        bio: formData.bio,
        teachSkills: Array.from(formData.teachSkills),
        learnSkills: Array.from(formData.learnSkills),
        languages: Array.from(formData.languages)
      };

      const result = await apiRequest(API_BASE, `/users/${encodeURIComponent(currentUser)}/profile`, {
        method: 'POST',
        body: JSON.stringify(profile)
      });
      
      setCurrentUserRecord(result.user);
      // Automatically publish first request
      await apiRequest(API_BASE, `/message-requests`, {
        method: 'POST',
        body: JSON.stringify({
          from_user_id: currentUser,
          to_user_id: null,
          offered_skill: profile.teachSkills.join(', '),
          requested_skill: profile.learnSkills.join(', '),
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
        <h2>Set Up Your Profile</h2>
        <p>Completa tu perfil inicial para entrar en el marketplace de intercambio.</p>

        <div className="field-grid">
          <div>
            <label>Nombre visible</label>
            <input 
              placeholder="Pedro" 
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
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
            <h3>Skills you want to teach</h3>
            <div className="summary-row">
              {Array.from(formData.teachSkills).map(s => <span key={s} className="chip">{s}</span>)}
            </div>
            <button className="ghost-btn" onClick={() => setPickerConfig({ mode: 'teach', initial: formData.teachSkills })}>
              Elegir habilidades para ofrecer
            </button>
          </div>

          <div className="select-card">
            <h3>Skills you want to learn</h3>
            <div className="summary-row">
              {Array.from(formData.learnSkills).map(s => <span key={s} className="chip">{s}</span>)}
            </div>
            <button className="ghost-btn" onClick={() => setPickerConfig({ mode: 'learn', initial: formData.learnSkills })}>
              Elegir habilidades para aprender
            </button>
          </div>

          <div className="select-card">
            <h3>Languages you speak</h3>
            <div className="summary-row">
              {Array.from(formData.languages).map(s => <span key={s} className="chip">{s}</span>)}
            </div>
            <button className="ghost-btn" onClick={() => setPickerConfig({ mode: 'language', initial: formData.languages })}>
              Elegir idiomas
            </button>
          </div>
        </div>

        <button className="primary-btn" onClick={handleComplete}>Continue</button>
      </div>

      {pickerConfig && (
        <SkillPicker 
          mode={pickerConfig.mode}
          initialSelection={pickerConfig.initial}
          onSave={(selection) => {
            const field = pickerConfig.mode === 'teach' ? 'teachSkills' : (pickerConfig.mode === 'learn' ? 'learnSkills' : 'languages');
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
