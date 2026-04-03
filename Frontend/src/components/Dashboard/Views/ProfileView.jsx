import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import SkillPicker from '../../Common/SkillPicker';
import { ensureSkillIds } from '../../../services/skills';

const ProfileView = () => {
  const { currentUser, currentUserRecord, dbUser, setCurrentUserRecord, getToken } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    bio: '',
    teachSkills: new Set(),
    learnSkills: new Set()
  });
  const [pickerConfig, setPickerConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Intentamos buscar la informacion en todas las posibles ubicaciones del objeto
    const source = dbUser || currentUserRecord?.dbUser || currentUserRecord || {};
    
    console.log('ProfileView loading from source:', source);

    const profile = source.profile || {};
    
    // Extraemos las habilidades con una logica simplificada pero infalible
    const getSkillNames = (list) => {
      if (!list || !Array.isArray(list)) return [];
      return list.map(item => typeof item === 'object' ? (item.nombre || item.name) : item).filter(Boolean);
    };

    const teach = getSkillNames(profile.teachSkills || source.habilidades_ofertadas);
    const learn = getSkillNames(profile.learnSkills || source.habilidades_buscadas);

    console.log('ProfileView final skills:', { teach, learn });

    setFormData({
      fullName: profile.fullName || `${source.nombre || ''} ${source.apellido || ''}`.trim() || '',
      bio: profile.bio || source.biografia || '',
      teachSkills: new Set(teach),
      learnSkills: new Set(learn)
    });
  }, [dbUser, currentUserRecord]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const teachSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.teachSkills), token);
      const learnSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.learnSkills), token);

      const parts = formData.fullName.trim().split(/\s+/).filter(Boolean);
      const nombre = parts[0] || '';
      const apellido = parts.slice(1).join(' ');

      const result = await apiRequest(API_BASE, `/usuarios/me/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
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
            {currentUserRecord?.rating && currentUserRecord.rating.count > 0 && (
              <div className="profile-rating">
                <span>★ {Number(currentUserRecord.rating.average).toFixed(1)}</span>
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                  ({currentUserRecord.rating.count})
                </span>
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
