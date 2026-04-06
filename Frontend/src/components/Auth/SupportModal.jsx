import React, { useState } from 'react';
import { API_BASE } from '../../config/constants';

const SupportModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    email: '',
    subject: '',
    message: '',
    category: 'other',
    honeypot: '' // Bot trap
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    { value: 'login', label: '🔐 Problema de acceso', icon: 'lock' },
    { value: 'technical', label: '🐛 Problema técnico', icon: 'bug_report' },
    { value: 'account', label: '👤 Cuenta', icon: 'person' },
    { value: 'other', label: '💬 Consulta general', icon: 'chat' }
  ];

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const canSubmit = 
    formData.email.trim() && 
    validateEmail(formData.email) &&
    formData.subject.trim().length >= 5 && 
    formData.message.trim().length >= 20 && 
    !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/support/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Error al enviar el mensaje');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFormData({
          email: '',
          subject: '',
          message: '',
          category: 'other',
          honeypot: ''
        });
      }, 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <style>{`
        /* Custom scrollbar styles for support modal */
        .support-modal-content::-webkit-scrollbar {
          width: 8px;
        }
        
        .support-modal-content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        
        .support-modal-content::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border-radius: 10px;
          transition: background 0.3s ease;
        }
        
        .support-modal-content::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        }
        
        /* Firefox scrollbar */
        .support-modal-content {
          scrollbar-width: thin;
          scrollbar-color: #6366f1 rgba(0, 0, 0, 0.05);
        }
      `}</style>
      
      <div className="support-modal-content bg-surface-container-high rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-outline-variant/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-primary-dim to-primary p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">support_agent</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-xl text-white">Contactar Soporte</h2>
              <p className="text-white/80 text-sm">Te responderemos a tu correo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-white">close</span>
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="m-6 bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-green-500 text-2xl">check_circle</span>
            <div>
              <p className="text-green-500 font-semibold">¡Mensaje enviado!</p>
              <p className="text-on-surface-variant text-sm mt-1">
                Te responderemos pronto al correo proporcionado.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="m-6 bg-error/10 border border-error/30 rounded-2xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-error text-2xl">error</span>
            <div>
              <p className="text-error font-semibold">Error</p>
              <p className="text-on-surface-variant text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Honeypot - hidden field for bots */}
          <input 
            type="text"
            name="website"
            value={formData.honeypot}
            onChange={(e) => setFormData({...formData, honeypot: e.target.value})}
            style={{ display: 'none' }}
            tabIndex="-1"
            autoComplete="off"
          />

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">
              Tu correo electrónico
            </label>
            <input 
              type="email"
              placeholder="correo@ejemplo.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              maxLength={100}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            {formData.email && !validateEmail(formData.email) && (
              <span className="text-error text-xs mt-1 block">Correo inválido</span>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">
              Categoría
            </label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData({...formData, category: cat.value})}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    formData.category === cat.value
                      ? 'border-primary bg-primary/10'
                      : 'border-outline-variant/30 bg-surface-container-low hover:border-outline-variant/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">
                      {cat.icon}
                    </span>
                    <span className="text-sm font-medium text-on-surface">
                      {cat.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">
              Asunto
            </label>
            <input 
              type="text"
              placeholder="Describe brevemente tu problema"
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              maxLength={200}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-on-surface-variant">
                {formData.subject.length < 5 && formData.subject.length > 0 && 
                  `Mínimo 5 caracteres (${5 - formData.subject.length} restantes)`
                }
              </span>
              <span className="text-xs text-on-surface-variant">
                {formData.subject.length}/200
              </span>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">
              Mensaje
            </label>
            <textarea 
              placeholder="Describe tu problema o consulta con el mayor detalle posible..."
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              maxLength={2000}
              rows={6}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-on-surface-variant">
                {formData.message.length < 20 && formData.message.length > 0 && 
                  `Mínimo 20 caracteres (${20 - formData.message.length} restantes)`
                }
              </span>
              <span className="text-xs text-on-surface-variant">
                {formData.message.length}/2000
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-xl">info</span>
              <div className="text-sm text-on-surface-variant">
                <p className="font-semibold text-on-surface mb-1">Tiempo de respuesta</p>
                <p>Normalmente respondemos en 24-48 horas hábiles. Te contactaremos al correo proporcionado.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-container-low border border-outline-variant/30 text-on-surface font-semibold py-3 rounded-full hover:bg-surface-container transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 bg-gradient-to-br from-primary-dim to-primary text-white font-bold py-3 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? 'Enviando...' : 'Enviar mensaje'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupportModal;
