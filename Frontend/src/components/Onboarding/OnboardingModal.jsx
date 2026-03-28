import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import SkillPicker from '../Common/SkillPicker';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';
import { ensureSkillIds } from '../../services/skills';

const NAME_MAX_LENGTH = 25;
const BIO_MAX_LENGTH = 500;

const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/;
const BIO_REGEX = /^[\w\sáéíóúÁÉÍÓÚñÑ+*=/%^.,!?:;()"'\\/-]*$/;

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
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    bio: ''
  });

  const validateField = (field, value) => {
    if (field === 'firstName' || field === 'lastName') {
      if (value.length > NAME_MAX_LENGTH) {
        return `Máximo ${NAME_MAX_LENGTH} caracteres`;
      }
      if (!NAME_REGEX.test(value)) {
        return 'Solo se permiten letras a-z';
      }
      return '';
    }
    if (field === 'bio') {
      if (value.length > BIO_MAX_LENGTH) {
        return `Máximo ${BIO_MAX_LENGTH} caracteres`;
      }
      if (!BIO_REGEX.test(value)) {
        return 'Caracteres no permitidos';
      }
      return '';
    }
    return '';
  };

  const handleInputChange = (field, value) => {
    let processedValue = value;
    const maxLength = field === 'bio' ? BIO_MAX_LENGTH : NAME_MAX_LENGTH;
    
    if (field === 'firstName' || field === 'lastName') {
      processedValue = value.slice(0, maxLength);
      const filtered = processedValue.split('').filter(char => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]$/.test(char)).join('');
      processedValue = filtered.slice(0, maxLength);
    } else if (field === 'bio') {
      processedValue = value.slice(0, maxLength);
    }

    const error = validateField(field, processedValue);
    
    setFormData({ ...formData, [field]: processedValue });
    setErrors({ ...errors, [field]: error });
  };

  const hasErrors = () => {
    return errors.firstName || errors.lastName || errors.bio || 
           !formData.firstName.trim() || !formData.lastName.trim() ||
           !formData.teachSkills.size || !formData.learnSkills.size;
  };

  const handleComplete = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert('Completa nombre y apellido para continuar.');
      return;
    }

    if (!formData.teachSkills.size || !formData.learnSkills.size) {
      alert('Selecciona al menos una habilidad para ofrecer y una para aprender.');
      return;
    }

    const overlap = [...formData.teachSkills].filter(s => formData.learnSkills.has(s));
    if (overlap.length > 0) {
      alert(`No puedes seleccionar la misma habilidad para ofrecer y aprender: ${overlap.join(', ')}`);
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
              onChange={(e) => handleInputChange('firstName', e.target.value)}
            />
            {errors.firstName && <span className="error-text">{errors.firstName}</span>}
          </div>
          <div>
            <label>Apellido</label>
            <input
              placeholder="González"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
            />
            {errors.lastName && <span className="error-text">{errors.lastName}</span>}
          </div>
          <div>
            <label>Bio corta</label>
            <textarea 
              placeholder="Cuéntale a otros que puedes ensenar y que quieres aprender..."
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
            />
            {errors.bio && <span className="error-text">{errors.bio}</span>}
            <span className="char-counter">{formData.bio.length}/{BIO_MAX_LENGTH}</span>
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

        <button 
          className="primary-btn" 
          onClick={handleComplete}
          disabled={hasErrors()}
        >
          Continuar
        </button>
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
