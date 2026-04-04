import React, { useEffect, useState } from 'react';
import { API_BASE, languagesCatalog, MAX_SKILLS } from '../../config/constants';
import { api as apiRequest } from '../../services/api';

const SkillPicker = ({ mode, source, onSave, onCancel, initialSelection = new Set() }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selection, setSelection] = useState(new Set(initialSelection));
  const [skillsCatalog, setSkillsCatalog] = useState({ Todas: [] });
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
        const grouped = { Todas: [] };

        habilidades.forEach((hab) => {
          const nombre = typeof hab?.nombre === 'string' ? hab.nombre.trim() : '';
          if (!nombre) return;
          const categoria = typeof hab?.categoria === 'string' && hab.categoria.trim() ? hab.categoria.trim() : 'Otros';

          if (!grouped[categoria]) grouped[categoria] = [];
          grouped[categoria].push(nombre);
          grouped.Todas.push(nombre);
        });

        Object.keys(grouped).forEach((categoria) => {
          grouped[categoria].sort((a, b) => a.localeCompare(b));
        });

        if (active) {
          setSkillsCatalog(grouped);
        }
      } catch (error) {
        console.error('Error loading skills catalog:', error);
        if (active) setSkillsCatalog({ Todas: [] });
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
      setSelectedCategory('Todas');
    }
  }, [mode, selectedCategory, skillsCatalog]);

  const toggleSkill = (skill) => {
    const newSelection = new Set(selection);
    if (newSelection.has(skill)) {
      newSelection.delete(skill);
    } else if (newSelection.size < MAX_SKILLS) {
      newSelection.add(skill);
    }
    setSelection(newSelection);
  };

  const categories = Object.keys(skillsCatalog);
  const currentSkills = mode === 'language' ? languagesCatalog : (skillsCatalog[selectedCategory] || []);

  const filteredSkills = currentSkills.filter(skill => 
    skill.toLowerCase().includes(search.toLowerCase())
  );

  const getTitle = () => {
    if (mode === 'language') return 'Seleccionar idiomas';
    return mode === 'teach' ? 'Seleccionar habilidades para ofrecer' : 'Seleccionar habilidades para aprender';
  };

  const getIcon = () => {
    if (mode === 'language') return 'language';
    return mode === 'teach' ? 'school' : 'auto_awesome';
  };

  const getColorClass = () => {
    if (mode === 'language') return 'primary';
    return mode === 'teach' ? 'secondary' : 'tertiary';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-surface-container-highest rounded-3xl border border-outline-variant/20 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-outline-variant/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-${getColorClass()}/10 flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-${getColorClass()} text-2xl`}>
                  {getIcon()}
                </span>
              </div>
              <div>
                <h2 className="font-headline font-bold text-2xl text-on-surface">{getTitle()}</h2>
                <p className="text-on-surface-variant text-sm">
                  {selection.size}/{MAX_SKILLS} {selection.size === 1 ? 'seleccionada' : 'seleccionadas'}
                </p>
              </div>
            </div>
            <button 
              onClick={onCancel}
              className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-center text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
              search
            </span>
            <input 
              type="text"
              placeholder="Buscar habilidades..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>


        {/* Categorías a la izquierda y habilidades a la derecha */}
        {mode !== 'language' ? (
          <div className="flex flex-1 min-h-0">
            {/* Categorías */}
            <div className="w-48 min-w-[15rem] max-w-[14rem] border-r border-outline-variant/20 bg-surface-container-low flex flex-col overflow-y-auto custom-scrollbar py-2">
              <div className="px-4 pb-2">
                <span className="block text-lg font-bold text-primary mb-2">Categorías</span>
              </div>
              {categories.map(cat => (
                <div key={cat} className={`m-2 rounded-xl border-2 transition-all ${selectedCategory === cat ? 'border-primary' : 'border-outline-variant/30'} bg-surface-container`}>
                  <button
                    className={`w-full px-4 py-3 text-left rounded-xl transition-all break-words whitespace-pre-line text-sm font-medium ${
                      selectedCategory === cat
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'bg-transparent text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                    style={{wordBreak: 'break-word', whiteSpace: 'pre-line'}}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                </div>
              ))}
            </div>
            {/* Habilidades */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {catalogLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-on-surface-variant">Cargando habilidades...</p>
                  </div>
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4">
                    search_off
                  </span>
                  <p className="text-on-surface-variant">No se encontraron habilidades</p>
                  <p className="text-on-surface-variant/70 text-sm mt-1">Intenta con otra búsqueda</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredSkills.map(skill => {
                    const isSelected = selection.has(skill);
                    const colorClass = mode === 'language' ? 'primary' : (mode === 'teach' ? 'secondary' : 'tertiary');
                    return (
                      <button
                        key={skill}
                        className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95 ${
                          isSelected
                            ? mode === 'language'
                              ? 'bg-primary text-white shadow-lg shadow-primary/20'
                              : mode === 'teach'
                              ? 'bg-secondary-container/40 text-secondary-fixed border-2 border-secondary-container/40 shadow-lg'
                              : 'bg-tertiary-container/30 text-tertiary-fixed border-2 border-tertiary-container/30 shadow-lg'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high border-2 border-transparent'
                        }`}
                        onClick={() => toggleSkill(skill)}
                      >
                        <span className="flex items-center gap-2">
                          {isSelected && (
                            <span className="material-symbols-outlined text-base" style={{fontVariationSettings: "'FILL' 1"}}>
                              check_circle
                            </span>
                          )}
                          {skill}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          // ...modo language original...
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {catalogLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-on-surface-variant">Cargando habilidades...</p>
                </div>
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4">
                  search_off
                </span>
                <p className="text-on-surface-variant">No se encontraron habilidades</p>
                <p className="text-on-surface-variant/70 text-sm mt-1">Intenta con otra búsqueda</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredSkills.map(skill => {
                  const isSelected = selection.has(skill);
                  const colorClass = mode === 'language' ? 'primary' : (mode === 'teach' ? 'secondary' : 'tertiary');
                  return (
                    <button
                      key={skill}
                      className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95 ${
                        isSelected
                          ? mode === 'language'
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : mode === 'teach'
                            ? 'bg-secondary-container/40 text-secondary-fixed border-2 border-secondary-container/40 shadow-lg'
                            : 'bg-tertiary-container/30 text-tertiary-fixed border-2 border-tertiary-container/30 shadow-lg'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high border-2 border-transparent'
                      }`}
                      onClick={() => toggleSkill(skill)}
                    >
                      <span className="flex items-center gap-2">
                        {isSelected && (
                          <span className="material-symbols-outlined text-base" style={{fontVariationSettings: "'FILL' 1"}}>
                            check_circle
                          </span>
                        )}
                        {skill}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low/50">
          <div className="flex items-center justify-between gap-4">
            <button 
              onClick={() => setSelection(new Set())}
              className="text-on-surface-variant hover:text-on-surface font-semibold transition-colors flex items-center gap-2"
              disabled={selection.size === 0}
            >
              <span className="material-symbols-outlined text-xl">clear_all</span>
              Limpiar todo
            </button>
            
            <div className="flex gap-3">
              <button 
                onClick={onCancel}
                className="px-6 py-3 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface font-semibold transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => onSave(selection)}
                className="px-8 py-3 rounded-full bg-gradient-to-br from-primary-dim to-primary hover:from-primary hover:to-primary-dim text-white font-bold shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-xl">check</span>
                Guardar ({selection.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillPicker;
