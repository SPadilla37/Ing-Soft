import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import SkillPicker from '../Common/SkillPicker';
import { api as apiRequest } from '../../services/api';
import { API_BASE, MIN_SKILLS, MAX_SKILLS } from '../../config/constants';
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
           formData.teachSkills.size < MIN_SKILLS || formData.teachSkills.size > MAX_SKILLS ||
           formData.learnSkills.size < MIN_SKILLS || formData.learnSkills.size > MAX_SKILLS;
  };

  const handleComplete = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert('Completa nombre y apellido para continuar.');
      return;
    }

    if (formData.teachSkills.size < MIN_SKILLS || formData.teachSkills.size > MAX_SKILLS) {
      alert(`Selecciona entre ${MIN_SKILLS} y ${MAX_SKILLS} habilidades para ofrecer.`);
      return;
    }

    if (formData.learnSkills.size < MIN_SKILLS || formData.learnSkills.size > MAX_SKILLS) {
      alert(`Selecciona entre ${MIN_SKILLS} y ${MAX_SKILLS} habilidades para aprender.`);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-surface-container-highest rounded-3xl p-8 border border-outline-variant/20 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="mb-6">
          <h2 className="font-headline font-bold text-3xl text-on-surface mb-2">Completa tu perfil</h2>
          <p className="text-on-surface-variant">
            Completa tu perfil inicial para entrar en el marketplace de intercambio.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">Nombre</label>
              <input 
                placeholder="Pedro"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              {errors.firstName && <span className="text-error text-xs mt-1 block">{errors.firstName}</span>}
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">Apellido</label>
              <input
                placeholder="González"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              {errors.lastName && <span className="text-error text-xs mt-1 block">{errors.lastName}</span>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">Bio corta</label>
            <textarea 
              placeholder="Cuéntale a otros qué puedes enseñar y qué quieres aprender..."
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              rows={4}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
            />
            {errors.bio && <span className="text-error text-xs mt-1 block">{errors.bio}</span>}
            <span className="text-on-surface-variant text-xs mt-1 block text-right">
              {formData.bio.length}/{BIO_MAX_LENGTH}
            </span>
          </div>

          <div className="space-y-4">
            <div className="bg-surface-container-low/50 rounded-2xl p-6 border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-secondary">school</span>
                <h3 className="font-semibold text-on-surface">Habilidades que quieres ofrecer</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                {Array.from(formData.teachSkills).map(s => (
                  <span key={s} className="px-4 py-1.5 rounded-full bg-secondary-container/30 text-secondary-fixed text-xs font-medium border border-secondary-container/20">
                    {s}
                  </span>
                ))}
                {formData.teachSkills.size === 0 && (
                  <span className="text-on-surface-variant text-sm italic">No has seleccionado habilidades</span>
                )}
              </div>
              <button 
                className="w-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface font-semibold py-3 rounded-xl transition-all"
                onClick={() => setPickerConfig({ mode: 'teach', initial: formData.teachSkills })}
              >
                Elegir habilidades para ofrecer
              </button>
            </div>

            <div className="bg-surface-container-low/50 rounded-2xl p-6 border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-tertiary">auto_awesome</span>
                <h3 className="font-semibold text-on-surface">Habilidades que quieres aprender</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                {Array.from(formData.learnSkills).map(s => (
                  <span key={s} className="px-4 py-1.5 rounded-full bg-tertiary-container/20 text-tertiary-fixed text-xs font-medium border border-tertiary-container/10">
                    {s}
                  </span>
                ))}
                {formData.learnSkills.size === 0 && (
                  <span className="text-on-surface-variant text-sm italic">No has seleccionado habilidades</span>
                )}
              </div>
              <button 
                className="w-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface font-semibold py-3 rounded-xl transition-all"
                onClick={() => setPickerConfig({ mode: 'learn', initial: formData.learnSkills })}
              >
                Elegir habilidades para aprender
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={handleComplete}
          disabled={hasErrors()}
          className="w-full mt-8 bg-gradient-to-br from-primary-dim to-primary hover:from-primary hover:to-primary-dim text-white font-bold py-4 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
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
    </div>
  );
};

export default OnboardingModal;
