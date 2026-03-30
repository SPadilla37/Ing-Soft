import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { API_BASE } from '../../../config/constants';

const SkillManagement = () => {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', categoria: '' });
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [errors, setErrors] = useState({ nombre: '', categoria: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const data = await api(API_BASE, '/admin/skills');
      setSkills(data.skills || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
      setAlert({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await api(API_BASE, '/admin/skills/categories');
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    fetchSkills();
    fetchCategories();
  }, []);

  const validateField = (name, value) => {
    // Validar longitud máxima según el campo
    const maxLength = name === 'categoria' ? 30 : 20;
    if (value.length > maxLength) {
      return `Máximo ${maxLength} caracteres`;
    }
    
    // Validar solo letras y espacios
    if (value && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/.test(value)) {
      return 'Solo se permiten letras y espacios';
    }
    
    return '';
  };

  const handleFieldChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    
    // Validar en tiempo real
    const error = validateField(field, value);
    setErrors({ ...errors, [field]: error });
    
    // Si es el campo categoría, filtrar categorías existentes
    if (field === 'categoria') {
      if (value.trim()) {
        const filtered = categories.filter(cat =>
          cat.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredCategories(filtered);
        setShowCategoryDropdown(filtered.length > 0);
      } else {
        setShowCategoryDropdown(false);
      }
    }
  };

  const selectCategory = (category) => {
    setFormData({ ...formData, categoria: category });
    setShowCategoryDropdown(false);
    setErrors({ ...errors, categoria: '' });
  };

  const handleCreateSkill = async () => {
    // Validar que ambos campos estén completos
    if (!formData.nombre.trim() || !formData.categoria.trim()) {
      setAlert({ type: 'error', message: 'Completa todos los campos' });
      return;
    }

    // Validar que no haya errores
    if (errors.nombre || errors.categoria) {
      setAlert({ type: 'error', message: 'Corrige los errores antes de continuar' });
      return;
    }

    try {
      await api(API_BASE, '/admin/skills', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setAlert({ type: 'success', message: 'Habilidad creada exitosamente' });
      fetchSkills();
      fetchCategories(); // Actualizar categorías
      setShowAddForm(false);
      setFormData({ nombre: '', categoria: '' });
      setErrors({ nombre: '', categoria: '' });
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    }
  };

  const handleDelete = async (skillId, skillName) => {
    if (!window.confirm(`¿Estás seguro de eliminar la habilidad "${skillName}"?`)) {
      return;
    }

    try {
      await api(API_BASE, `/admin/skills/${skillId}`, { method: 'DELETE' });
      setAlert({ type: 'success', message: 'Habilidad eliminada exitosamente' });
      fetchSkills();
      fetchCategories(); // Actualizar categorías
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    }
  };

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Filtrar habilidades por nombre o categoría
  const filteredSkills = skills.filter((skill) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      skill.nombre.toLowerCase().includes(searchLower) ||
      skill.categoria.toLowerCase().includes(searchLower)
    );
  });

  if (loading) return <div className="p-8 text-[#dee5ff]">Cargando...</div>;

  return (
    <div className="p-8 space-y-6">
      {/* Alert */}
      {alert && (
        <div
          className={`p-4 rounded-lg ${
            alert.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {alert.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[#dee5ff] text-2xl font-semibold">Gestión de Habilidades</h1>
          <p className="text-[#a3aac4] text-sm mt-2">
            Administra el catálogo de habilidades disponibles
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-[#4967f4] text-white rounded-lg hover:bg-[#99a9ff] flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-xl">
            {showAddForm ? 'close' : 'add'}
          </span>
          <span>{showAddForm ? 'Cancelar' : 'Agregar Habilidad'}</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-[#141f38] rounded-2xl p-6 space-y-4">
          <h3 className="text-[#dee5ff] text-lg font-semibold">Nueva Habilidad</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Campo Nombre */}
            <div>
              <label className="block text-[#a3aac4] text-sm mb-2">
                Nombre de la habilidad
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleFieldChange('nombre', e.target.value)}
                maxLength={20}
                placeholder="Ej: Python"
                className="w-full bg-[#1f2b49] text-[#dee5ff] px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-[#4967f4]"
              />
              {errors.nombre && (
                <span className="text-red-400 text-xs mt-1 block">{errors.nombre}</span>
              )}
              <span className="text-[#a3aac4] text-xs mt-1 block">
                {formData.nombre.length}/20 caracteres
              </span>
            </div>

            {/* Campo Categoría con autocompletado */}
            <div className="relative">
              <label className="block text-[#a3aac4] text-sm mb-2">
                Categoría
              </label>
              <input
                type="text"
                value={formData.categoria}
                onChange={(e) => handleFieldChange('categoria', e.target.value)}
                onFocus={() => {
                  if (formData.categoria.trim() && filteredCategories.length > 0) {
                    setShowCategoryDropdown(true);
                  }
                }}
                maxLength={30}
                placeholder="Ej: Tecnología"
                className="w-full bg-[#1f2b49] text-[#dee5ff] px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-[#4967f4]"
              />
              {errors.categoria && (
                <span className="text-red-400 text-xs mt-1 block">{errors.categoria}</span>
              )}
              <span className="text-[#a3aac4] text-xs mt-1 block">
                {formData.categoria.length}/30 caracteres
              </span>
              
              {/* Dropdown de autocompletado */}
              {showCategoryDropdown && filteredCategories.length > 0 && (
                <ul className="absolute z-10 w-full bg-[#1f2b49] border border-[#4967f4] rounded-lg mt-1 max-h-40 overflow-y-auto">
                  {filteredCategories.map((cat, idx) => (
                    <li
                      key={idx}
                      onClick={() => selectCategory(cat)}
                      className="px-4 py-2 text-[#dee5ff] hover:bg-[#4967f4] cursor-pointer"
                    >
                      {cat}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setShowAddForm(false);
                setFormData({ nombre: '', categoria: '' });
                setErrors({ nombre: '', categoria: '' });
              }}
              className="px-4 py-2 bg-[#1f2b49] text-[#dee5ff] rounded-lg hover:bg-[#141f38]"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateSkill}
              disabled={!formData.nombre.trim() || !formData.categoria.trim() || errors.nombre || errors.categoria}
              className="px-4 py-2 bg-[#4967f4] text-white rounded-lg hover:bg-[#99a9ff] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Crear Habilidad
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-[#141f38] rounded-2xl p-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#a3aac4] text-xl">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre de habilidad o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1f2b49] text-[#dee5ff] pl-10 pr-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-[#4967f4]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3aac4] hover:text-[#dee5ff]"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Skills Table */}
      <div className="bg-[#141f38] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#1f2b49]">
            <tr>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Nombre</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Categoría</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Usuarios Ofertan</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Usuarios Buscan</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSkills.map((skill) => (
              <tr key={skill.id} className="border-t border-[#1f2b49]">
                <td className="px-6 py-4 text-[#dee5ff] text-sm">{skill.nombre}</td>
                <td className="px-6 py-4 text-[#a3aac4] text-sm">{skill.categoria}</td>
                <td className="px-6 py-4 text-[#a3aac4] text-sm">{skill.users_offering}</td>
                <td className="px-6 py-4 text-[#a3aac4] text-sm">{skill.users_seeking}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleDelete(skill.id, skill.nombre)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredSkills.length === 0 && skills.length > 0 && (
        <div className="text-center text-[#a3aac4] py-8">
          No se encontraron habilidades que coincidan con "{searchTerm}"
        </div>
      )}

      {skills.length === 0 && (
        <div className="text-center text-[#a3aac4] py-8">
          No hay habilidades registradas
        </div>
      )}
    </div>
  );
};

export default SkillManagement;
