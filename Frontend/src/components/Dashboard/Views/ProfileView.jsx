import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
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
    <section id="profileView" className="view active">
      <div className="profile-shell surface-card">
        <div className="profile-layout">
          <div className="profile-avatar-panel">
            <div className="profile-avatar-large">{getInitials(formData.fullName)}</div>
            <div className="profile-avatar-note">Tu avatar se genera con tu inicial.</div>
            {currentUserRecord?.username && (
              <div className="profile-username">@{currentUserRecord.username}</div>
            )}
            {currentUserRecord?.rating && (
              <div className="profile-rating rating-star">
                {currentUserRecord.rating.average != null 
                  ? <>★ {Number(currentUserRecord.rating.average).toFixed(1)} / 5 ({currentUserRecord.rating.count})</>
                  : 'Sin calificaciones'}
              </div>
            )}
          </div>

          <div className="profile-form-shell">
            <label>Nombre</label>
            <input 
              placeholder="Tu nombre" 
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            />
            <label>Descripción del perfil</label>
            <textarea 
              className="profile-textarea" 
              placeholder="Habla de tus intereses..." 
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
            />

            <div className="profile-meta-row">
              <div className="profile-summary-block">
                <label>Habilidades que quieres ofrecer</label>
                <button className="picker-trigger" onClick={() => setPickerConfig({ mode: 'teach', initial: formData.teachSkills })}>
                  Seleccionar habilidades
                </button>
                <div className="summary-row">
                  {Array.from(formData.teachSkills).map(s => <span key={s} className="chip">{s}</span>)}
                </div>
              </div>
              <div className="profile-summary-block">
                <label>Habilidades que quieres aprender</label>
                <button className="picker-trigger" onClick={() => setPickerConfig({ mode: 'learn', initial: formData.learnSkills })}>
                  Seleccionar habilidades
                </button>
                <div className="summary-row">
                  {Array.from(formData.learnSkills).map(s => <span key={s} className="chip">{s}</span>)}
                </div>
              </div>
            </div>

            <div className="profile-actions">
              <button className="primary-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </div>
          </div>
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
