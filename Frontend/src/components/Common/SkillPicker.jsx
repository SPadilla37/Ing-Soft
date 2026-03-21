import React, { useState } from 'react';
import { skillsCatalog, languagesCatalog } from '../../config/constants';

const SkillPicker = ({ mode, source, onSave, onCancel, initialSelection = new Set() }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selection, setSelection] = useState(new Set(initialSelection));

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
          {filteredSkills.map(skill => (
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
