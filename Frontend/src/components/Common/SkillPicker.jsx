import React, { useEffect, useState } from 'react';
import { API_BASE, languagesCatalog } from '../../config/constants';
import { api as apiRequest } from '../../services/api';

const SkillPicker = ({ mode, source, onSave, onCancel, initialSelection = new Set() }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selection, setSelection] = useState(new Set(initialSelection));
  const [skillsCatalog, setSkillsCatalog] = useState({ All: [] });
  const [catalogLoading, setCatalogLoading] = useState(mode !== 'language');

  useEffect(() => {
    if (mode === 'language') {
      setCatalogLoading(false);
      return;
    }

    let active = true;
    const loadCatalog = async () => {
      setCatalogLoading(true);
      try {
        const result = await apiRequest(API_BASE, '/habilidades');
        const habilidades = Array.isArray(result?.habilidades) ? result.habilidades : [];
        const grouped = { All: [] };

        habilidades.forEach((hab) => {
          const nombre = typeof hab?.nombre === 'string' ? hab.nombre.trim() : '';
          if (!nombre) return;
          const categoria = typeof hab?.categoria === 'string' && hab.categoria.trim() ? hab.categoria.trim() : 'Otros';

          if (!grouped[categoria]) grouped[categoria] = [];
          grouped[categoria].push(nombre);
          grouped.All.push(nombre);
        });

        Object.keys(grouped).forEach((categoria) => {
          grouped[categoria].sort((a, b) => a.localeCompare(b));
        });

        if (active) {
          setSkillsCatalog(grouped);
        }
      } catch (error) {
        console.error('Error loading skills catalog:', error);
        if (active) setSkillsCatalog({ All: [] });
      } finally {
        if (active) setCatalogLoading(false);
      }
    };

    loadCatalog();
    return () => {
      active = false;
    };
  }, [mode]);

  useEffect(() => {
    if (mode === 'language') return;
    if (!skillsCatalog[selectedCategory]) {
      setSelectedCategory('All');
    }
  }, [mode, selectedCategory, skillsCatalog]);

  const toggleSkill = (skill) => {
    const newSelection = new Set(selection);
    if (newSelection.has(skill)) {
      newSelection.delete(skill);
    } else {
      newSelection.add(skill);
    }
    setSelection(newSelection);
  };

  const categories = Object.keys(skillsCatalog);
  const currentSkills = mode === 'language' ? languagesCatalog : (skillsCatalog[selectedCategory] || []);

  const filteredSkills = currentSkills.filter(skill => 
    skill.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section id="skillPickerOverlay" className="picker-overlay">
      <div className="picker-card">
        <h2>{mode === 'language' ? 'Seleccionar idiomas' : `Seleccionar habilidades para ${mode === 'teach' ? 'ofrecer' : 'aprender'}`}</h2>
        <input 
          placeholder="Buscar..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {mode !== 'language' && (
          <div className="chip-row" style={{ marginTop: '0.8rem' }}>
            {categories.map(cat => (
              <button 
                key={cat} 
                className={`chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        <div className="skills-list">
          {catalogLoading && mode !== 'language' ? <p>Cargando habilidades...</p> : null}
          {!catalogLoading && filteredSkills.map(skill => (
            <button 
              key={skill} 
              className={`skill-chip ${selection.has(skill) ? 'active' : ''}`}
              onClick={() => toggleSkill(skill)}
            >
              {skill}
            </button>
          ))}
        </div>
        <div className="picker-actions">
          <button className="primary-btn" onClick={() => onSave(selection)}>Save</button>
          <button className="picker-clear" onClick={() => setSelection(new Set())}>Clear all</button>
          <button className="ghost-btn" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </section>
  );
};

export default SkillPicker;
