import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE, MIN_SKILLS, MAX_SKILLS } from '../../../config/constants';
import SkillPicker from '../../Common/SkillPicker';
import { ensureSkillIds } from '../../../services/skills';

const ProfileView = () => {
  const { currentUser, currentUserRecord, setCurrentUserRecord } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    bio: '',
    teachSkills: new Set(),
    learnSkills: new Set()
  });
  const [pickerConfig, setPickerConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUserRecord?.profile) {
      const p = currentUserRecord.profile;
      setFormData({
        fullName: p.fullName || '',
        bio: p.bio || '',
        teachSkills: new Set(p.teachSkills || []),
        learnSkills: new Set(p.learnSkills || [])
      });
    }
  }, [currentUserRecord]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const teachSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.teachSkills));
      const learnSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.learnSkills));

      if (formData.teachSkills.size < MIN_SKILLS || formData.teachSkills.size > MAX_SKILLS) {
        alert(`Selecciona entre ${MIN_SKILLS} y ${MAX_SKILLS} habilidades para ofrecer.`);
        setSaving(false);
        return;
      }

      if (formData.learnSkills.size < MIN_SKILLS || formData.learnSkills.size > MAX_SKILLS) {
        alert(`Selecciona entre ${MIN_SKILLS} y ${MAX_SKILLS} habilidades para aprender.`);
        setSaving(false);
        return;
      }

      const overlap = [...formData.teachSkills].filter(s => formData.learnSkills.has(s));
      if (overlap.length > 0) {
        alert(`No puedes seleccionar la misma habilidad para ofrecer y aprender: ${overlap.join(', ')}`);
        setSaving(false);
        return;
      }

      const parts = formData.fullName.trim().split(/\s+/).filter(Boolean);
      const nombre = parts[0] || '';
      const apellido = parts.slice(1).join(' ');

      const result = await apiRequest(API_BASE, `/usuarios/${encodeURIComponent(currentUser)}/profile`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre,
          apellido,
          biografia: formData.bio,
          habilidades_ofertadas: teachSkillIds,
          habilidades_buscadas: learnSkillIds,
        })
      });
      setCurrentUserRecord(result.user);
      alert('Perfil guardado correctamente.');
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/20 via-surface-container-high/60 to-surface-container/40 backdrop-blur-sm rounded-2xl p-8 border border-primary/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-3xl">person</span>
          </div>
          <div>
            <h2 className="font-headline font-bold text-3xl text-on-surface">Mi Perfil</h2>
            <p className="text-on-surface-variant mt-1">
              Actualiza tu información y habilidades
            </p>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-8">
        {/* Avatar Panel */}
        <div className="bg-surface-container-highest rounded-2xl border border-outline-variant/10 p-8 flex flex-col items-center text-center space-y-4">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-dim to-primary flex items-center justify-center text-white font-bold text-5xl shadow-lg">
            {getInitials(formData.fullName)}
          </div>
          <p className="text-on-surface-variant text-sm">
            Tu avatar se genera con tus iniciales
          </p>
          {currentUserRecord?.username && (
            <div className="px-4 py-2 bg-surface-container rounded-full">
              <p className="text-on-surface font-semibold">@{currentUserRecord.username}</p>
            </div>
          )}
          {currentUserRecord?.rating && (
            <div className="bg-surface-container-low/50 rounded-xl p-4 w-full">
              <p className="text-sm font-semibold text-on-surface mb-2">Calificación</p>
              <div className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl" style={{fontVariationSettings: "'FILL' 1"}}>
                  star
                </span>
                <span className="text-2xl font-bold text-on-surface">
                  {currentUserRecord.rating.average != null 
                    ? Number(currentUserRecord.rating.average).toFixed(1)
                    : 'N/A'}
                </span>
                <span className="text-on-surface-variant">/ 5</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                ({currentUserRecord.rating.count || 0} {currentUserRecord.rating.count === 1 ? 'reseña' : 'reseñas'})
              </p>
            </div>
          )}
        </div>

        {/* Form Panel */}
        <div className="bg-surface-container-highest rounded-2xl border border-outline-variant/10 p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">Nombre completo</label>
            <input 
              placeholder="Tu nombre completo" 
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">Descripción del perfil</label>
            <textarea 
              placeholder="Habla de tus intereses..." 
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              rows={4}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-surface-container-low/50 rounded-xl p-6 border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-secondary">school</span>
                <label className="text-sm font-semibold text-on-surface">Habilidades que ofreces</label>
              </div>
              <button 
                className="w-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface font-semibold py-3 rounded-xl transition-all mb-4"
                onClick={() => setPickerConfig({ mode: 'teach', initial: formData.teachSkills })}
              >
                Seleccionar habilidades
              </button>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {Array.from(formData.teachSkills).map(s => (
                  <span key={s} className="px-3 py-1.5 rounded-full bg-secondary-container/30 text-secondary-fixed text-xs font-medium border border-secondary-container/20">
                    {s}
                  </span>
                ))}
                {formData.teachSkills.size === 0 && (
                  <span className="text-on-surface-variant text-sm italic">No has seleccionado habilidades</span>
                )}
              </div>
            </div>

            <div className="bg-surface-container-low/50 rounded-xl p-6 border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-tertiary">auto_awesome</span>
                <label className="text-sm font-semibold text-on-surface">Habilidades que buscas</label>
              </div>
              <button 
                className="w-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface font-semibold py-3 rounded-xl transition-all mb-4"
                onClick={() => setPickerConfig({ mode: 'learn', initial: formData.learnSkills })}
              >
                Seleccionar habilidades
              </button>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {Array.from(formData.learnSkills).map(s => (
                  <span key={s} className="px-3 py-1.5 rounded-full bg-tertiary-container/20 text-tertiary-fixed text-xs font-medium border border-tertiary-container/10">
                    {s}
                  </span>
                ))}
                {formData.learnSkills.size === 0 && (
                  <span className="text-on-surface-variant text-sm italic">No has seleccionado habilidades</span>
                )}
              </div>
            </div>
          </div>

          <button 
            className="w-full bg-gradient-to-br from-primary-dim to-primary hover:from-primary hover:to-primary-dim text-white font-bold py-4 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </div>
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

export default ProfileView;
