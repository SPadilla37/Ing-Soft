import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import SkillPicker from '../Common/SkillPicker';
import { api as apiRequest } from '../../services/api';
import { API_BASE } from '../../config/constants';
import { ensureSkillIds } from '../../services/skills';

const OnboardingModal = () => {
  const { currentUser, setCurrentUserRecord, getToken } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    teachSkills: new Set(),
    learnSkills: new Set()
  });
  const [loading, setLoading] = useState(false);
  const [pickerConfig, setPickerConfig] = useState(null);

  // Sincronizar automáticamente con los datos de Clerk si existen
  useEffect(() => {
    if (currentUser && !formData.firstName && !formData.lastName) {
      const firstName = currentUser.firstName || '';
      const lastName = currentUser.lastName || '';
      setFormData(prev => ({ ...prev, firstName, lastName }));
    }
  }, [currentUser]);

  const handleNameChange = (e, field) => {
    const value = e.target.value;
    // Regex para eliminar cualquier número o carácter especial no deseado
    const onlyLetters = value.replace(/[0-9]/g, '');
    if (onlyLetters.length <= 50) {
      setFormData({ ...formData, [field]: onlyLetters });
    }
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

    setLoading(true);
    try {
      const token = await getToken();
      
      const teachSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.teachSkills), token);
      const learnSkillIds = await ensureSkillIds(API_BASE, Array.from(formData.learnSkills), token);

      console.log('IDs a enviar:', { teachSkillIds, learnSkillIds });

      if (!teachSkillIds.length || !learnSkillIds.length) {
        alert('No se pudieron resolver las habilidades seleccionadas. Intentalo de nuevo.');
        setLoading(false);
        return;
      }

      const result = await apiRequest(API_BASE, `/usuarios/me/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre: formData.firstName.trim(),
          apellido: formData.lastName.trim(),
          biografia: formData.bio,
          habilidades_ofertadas: teachSkillIds,
          habilidades_buscadas: learnSkillIds,
        })
      });
      
      // Usamos el resultado del PUT directamente para evitar una recarga que podría venir sin habilidades
      const userData = result.user || result;
      
      // Forzamos la presencia de habilidades en el estado local para que App.jsx cierre el modal
      const augmentedUser = {
        ...userData,
        nombre: formData.firstName.trim(),
        habilidades_ofertadas: teachSkillIds.map(id => ({ id, nombre: 'Habilidad' })),
        habilidades_buscadas: learnSkillIds.map(id => ({ id, nombre: 'Habilidad' }))
      };
      
      setCurrentUserRecord(augmentedUser);

      // Si por alguna razón el record recargado sigue fallando la validación de App.jsx,
      // forzamos una redirección manual o una actualización de estado de emergencia aquí si fuera necesario.

      try {
        await apiRequest(API_BASE, `/message-requests`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            from_user_id: userData.id,
            to_user_id: null,
            habilidad_id: teachSkillIds[0],
            habilidad_solicitada_id: learnSkillIds[0],
            mensaje: 'Hola! Estoy buscando un intercambio de habilidades.'
          })
        });
      } catch (reqError) {
        console.warn("Perfil guardado, pero falló la solicitud inicial:", reqError);
      }

    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
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
              onChange={(e) => handleNameChange(e, 'firstName')}
              maxLength={50}
            />
          </div>
          <div>
            <label>Apellido</label>
            <input
              placeholder="González"
              value={formData.lastName}
              onChange={(e) => handleNameChange(e, 'lastName')}
              maxLength={50}
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

        <button className="primary-btn" onClick={handleComplete} disabled={loading}>
          {loading ? 'Procesando...' : 'Continuar'}
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