import React, { useState } from 'react';
import { api } from '../../services/api';
import { API_BASE } from '../../config/constants';
import { validateReviewCommentText } from '../../utils/textModeration';
import './ReportModal.css';

const PREDEFINED_REASONS = [
  'Comportamiento inapropiado',
  'Información falsa en perfil',
  'No cumplió con el intercambio',
  'Spam o contenido no deseado',
  'Suplantación de identidad',
  'Otro motivo'
];

const MAX_DESCRIPTION_LENGTH = 500;

export default function ReportModal({ isOpen, onClose, reportedUserId, reportedUsername }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [moderationError, setModerationError] = useState(null);

  const handleReasonChange = (e) => {
    setReason(e.target.value);
    setError(null);
  };

  const handleDescriptionChange = (e) => {
    const value = e.target.value;
    if (value.length <= MAX_DESCRIPTION_LENGTH) {
      setDescription(value);
      setError(null);
      
      // Validate text moderation
      const modError = validateReviewCommentText(value, MAX_DESCRIPTION_LENGTH);
      setModerationError(modError || null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!reason) {
      setError('Por favor selecciona un motivo');
      return;
    }

    // Validate description is required when "Otro motivo" is selected
    if (reason === 'Otro motivo' && !description.trim()) {
      setError('La descripción es obligatoria cuando seleccionas "Otro motivo"');
      return;
    }

    // Check for moderation errors
    if (moderationError) {
      setError(moderationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api(API_BASE, '/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportado_id: reportedUserId,
          motivo: reason,
          descripcion: description || null
        })
      });

      // Show success message
      showToast('Reporte enviado exitosamente', 'success');
      
      // Reset form and close modal
      setReason('');
      setDescription('');
      setError(null);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al enviar el reporte');
      showToast(err.message || 'Error al enviar el reporte', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setReason('');
    setDescription('');
    setError(null);
    setModerationError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay" onClick={handleCancel}>
      <div className="report-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <h2>Reportar Usuario</h2>
          <button 
            className="report-modal-close" 
            onClick={handleCancel}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <div className="report-modal-content">
          <p className="report-modal-username">
            Reportando a: <strong>{reportedUsername}</strong>
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reason">Motivo del reporte *</label>
              <select
                id="reason"
                value={reason}
                onChange={handleReasonChange}
                disabled={isSubmitting}
                className="form-select"
              >
                <option value="">Selecciona un motivo</option>
                {PREDEFINED_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description">
                Descripción {reason === 'Otro motivo' ? '*' : '(opcional)'}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={handleDescriptionChange}
                placeholder={
                  reason === 'Otro motivo'
                    ? 'Por favor describe el motivo del reporte...'
                    : 'Proporciona detalles adicionales sobre el problema...'
                }
                disabled={isSubmitting}
                className="form-textarea"
                rows="4"
                required={reason === 'Otro motivo'}
              />
              <div className="character-counter">
                {description.length} / {MAX_DESCRIPTION_LENGTH} caracteres
              </div>
              {moderationError && (
                <div className="moderation-error">
                  ⚠️ {moderationError}
                </div>
              )}
              {reason === 'Otro motivo' && (
                <div className="field-hint">
                  La descripción es obligatoria para "Otro motivo"
                </div>
              )}
            </div>

            <div className="warning-box">
              <p>
                <strong>⚠️ Advertencia:</strong> Los reportes falsos o abusivos pueden resultar en 
                la suspensión de tu cuenta. Por favor, sé honesto y específico.
              </p>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason || (reason === 'Otro motivo' && !description.trim()) || moderationError}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Helper function to show toast notifications
function showToast(message, type = 'info') {
  // This assumes you have a toast notification system in place
  // Adjust based on your actual implementation
  const event = new CustomEvent('showToast', {
    detail: { message, type }
  });
  window.dispatchEvent(event);
}
