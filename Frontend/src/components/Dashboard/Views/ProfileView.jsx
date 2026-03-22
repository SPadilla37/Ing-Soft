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
    learnSkills: new Set(),
    languages: new Set()
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
        learnSkills: new Set(p.learnSkills || []),
        languages: new Set(p.languages || [])
      });
    }
  }, [currentUserRecord]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const teachSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.teachSkills));
      const learnSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.learnSkills));

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
            <button className="primary-btn" type="button">Change Avatar</button>
            <div className="profile-avatar-note">Tu avatar se genera con tu inicial.</div>
          </div>

          <div className="profile-form-shell">
            <label>Your name</label>
            <input 
              placeholder="Tu nombre" 
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            />
            <label>Profile description</label>
            <textarea 
              className="profile-textarea" 
              placeholder="Habla de tus intereses..." 
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
            />

            <div className="profile-meta-row">
              <div className="profile-summary-block">
                <label>Skills you want to teach</label>
                <button className="picker-trigger" onClick={() => setPickerConfig({ mode: 'teach', initial: formData.teachSkills })}>
                  Seleccionar habilidades
                </button>
                <div className="summary-row">
                  {Array.from(formData.teachSkills).map(s => <span key={s} className="chip">{s}</span>)}
                </div>
              </div>
              <div className="profile-summary-block">
                <label>Skills you want to learn</label>
                <button className="picker-trigger" onClick={() => setPickerConfig({ mode: 'learn', initial: formData.learnSkills })}>
                  Seleccionar habilidades
                </button>
                <div className="summary-row">
                  {Array.from(formData.learnSkills).map(s => <span key={s} className="chip">{s}</span>)}
                </div>
              </div>
              <div className="profile-summary-block">
                <label>Languages you speak</label>
                <button className="picker-trigger" onClick={() => setPickerConfig({ mode: 'language', initial: formData.languages })}>
                  Seleccionar idiomas
                </button>
                <div className="summary-row">
                  {Array.from(formData.languages).map(s => <span key={s} className="chip">{s}</span>)}
                </div>
              </div>
            </div>

            <div className="profile-actions">
              <button className="primary-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Save Profile'}
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

export default ProfileView;
