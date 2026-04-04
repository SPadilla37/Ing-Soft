import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import './ReportsView.css';

const STATUS_COLORS = {
  pendiente: '#ef4444',
  en_revision: '#f59e0b',
  resuelto: '#10b981',
  descartado: '#6b7280'
};

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_revision: 'En Revisión',
  resuelto: 'Resuelto',
  descartado: 'Descartado'
};

export default function ReportsView() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ pending_count: 0, resolved_count: 0, total_count: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const LIMIT = 10;

  // Fetch reports and stats on mount and when filters change
  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [statusFilter, searchQuery, currentPage]);

  const fetchReports = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: LIMIT,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery })
      });

      const data = await api(API_BASE, `/admin/reports?${params}`);
      setReports(data.reports);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api(API_BASE, '/admin/reports/stats');
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  const handleViewDetail = async (reportId) => {
    try {
      const data = await api(API_BASE, `/admin/reports/${reportId}`);
      setSelectedReport(data);
      setShowDetailModal(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleStartReview = async (reportId) => {
    try {
      await api(API_BASE, `/admin/reports/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'en_revision' })
      });

      showToast('Reporte marcado como en revisión', 'success');
      fetchReports();
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDiscard = async (reportId) => {
    if (!window.confirm('¿Estás seguro de que deseas descartar este reporte?')) {
      return;
    }

    try {
      await api(API_BASE, `/admin/reports/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'descartado' })
      });

      showToast('Reporte descartado', 'success');
      fetchReports();
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleResolve = async (reportId, action, notas = '') => {
    const actionLabels = {
      ninguna: 'sin acción',
      advertencia: 'con advertencia',
      suspension: 'con suspensión',
      eliminacion: 'con eliminación'
    };

    if (!window.confirm(`¿Estás seguro de que deseas resolver este reporte ${actionLabels[action]}?`)) {
      return;
    }

    try {
      await api(API_BASE, `/admin/reports/${reportId}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ action, notas_admin: notas })
      });

      showToast(`Reporte resuelto ${actionLabels[action]}`, 'success');
      fetchReports();
      fetchStats();
      setShowDetailModal(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getActionButtons = (report) => {
    if (report.estado === 'pendiente') {
      return (
        <>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleStartReview(report.id)}
          >
            Revisar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleDiscard(report.id)}
          >
            Descartar
          </button>
        </>
      );
    } else if (report.estado === 'en_revision') {
      return (
        <>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleViewDetail(report.id)}
          >
            Resolver
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleDiscard(report.id)}
          >
            Descartar
          </button>
        </>
      );
    } else {
      return (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => handleViewDetail(report.id)}
        >
          Ver Detalle
        </button>
      );
    }
  };

  return (
    <div className="reports-view">
      <div className="reports-header">
        <h1>Panel de Reportes</h1>
        <p>Gestiona y revisa los reportes de usuarios</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-container">
        <div className="stat-card stat-pending">
          <div className="stat-value">{stats.pending_count}</div>
          <div className="stat-label">Reportes Pendientes</div>
        </div>
        <div className="stat-card stat-resolved">
          <div className="stat-value">{stats.resolved_count}</div>
          <div className="stat-label">Reportes Resueltos</div>
        </div>
        <div className="stat-card stat-total">
          <div className="stat-value">{stats.total_count}</div>
          <div className="stat-label">Total de Reportes</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="filters-container">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => handleStatusChange('all')}
          >
            Todos
          </button>
          <button
            className={`filter-btn ${statusFilter === 'pendiente' ? 'active' : ''}`}
            onClick={() => handleStatusChange('pendiente')}
          >
            Pendiente
          </button>
          <button
            className={`filter-btn ${statusFilter === 'en_revision' ? 'active' : ''}`}
            onClick={() => handleStatusChange('en_revision')}
          >
            En Revisión
          </button>
          <button
            className={`filter-btn ${statusFilter === 'resuelto' ? 'active' : ''}`}
            onClick={() => handleStatusChange('resuelto')}
          >
            Resuelto
          </button>
          <button
            className={`filter-btn ${statusFilter === 'descartado' ? 'active' : ''}`}
            onClick={() => handleStatusChange('descartado')}
          >
            Descartado
          </button>
        </div>

        <div className="search-container">
          <input
            type="text"
            placeholder="Buscar por nombre de usuario..."
            value={searchQuery}
            onChange={handleSearch}
            className="search-input"
          />
        </div>
      </div>

      {/* Reports Grid */}
      <div className="reports-container">
        {isLoading ? (
          <div className="loading-spinner">Cargando reportes...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : reports.length === 0 ? (
          <div className="empty-state">No hay reportes para mostrar</div>
        ) : (
          <div className="reports-grid">
            {reports.map((report) => (
              <div key={report.id} className="report-card">
                <div className="report-card-header">
                  <div className="report-user-info">
                    <h3>{report.reportado_username}</h3>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: STATUS_COLORS[report.estado] }}
                    >
                      {STATUS_LABELS[report.estado]}
                    </span>
                  </div>
                  <div className="report-date">
                    {new Date(report.fecha_creacion).toLocaleDateString()}
                  </div>
                </div>

                <div className="report-card-body">
                  <div className="report-reason">
                    <strong>Motivo:</strong> {report.motivo}
                  </div>
                  {report.descripcion && (
                    <div className="report-description">
                      <strong>Descripción:</strong> {report.descripcion}
                    </div>
                  )}
                </div>

                <div className="report-card-footer">
                  <div className="action-buttons">
                    {getActionButtons(report)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ← Anterior
          </button>

          <div className="pagination-info">
            Página {currentPage} de {totalPages}
          </div>

          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalles del Reporte</h2>
              <button
                className="modal-close"
                onClick={() => setShowDetailModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Usuario Reportado</h3>
                <p>{selectedReport.reportado_username}</p>
                {selectedReport.reportado && (
                  <p className="detail-meta">ID: {selectedReport.reportado.id} | Email: {selectedReport.reportado.email}</p>
                )}
              </div>

              {selectedReport.reportante && (
                <div className="detail-section">
                  <h3>Reportado por</h3>
                  <p>{selectedReport.reportante.username}</p>
                  <p className="detail-meta">ID: {selectedReport.reportante.id} | Email: {selectedReport.reportante.email}</p>
                </div>
              )}

              <div className="detail-section">
                <h3>Motivo</h3>
                <p>{selectedReport.motivo}</p>
              </div>

              {selectedReport.descripcion && (
                <div className="detail-section">
                  <h3>Descripción</h3>
                  <p>{selectedReport.descripcion}</p>
                </div>
              )}

              <div className="detail-section">
                <h3>Estado</h3>
                <p>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: STATUS_COLORS[selectedReport.estado] }}
                  >
                    {STATUS_LABELS[selectedReport.estado]}
                  </span>
                </p>
              </div>

              <div className="detail-section">
                <h3>Fecha de Creación</h3>
                <p>{new Date(selectedReport.fecha_creacion).toLocaleString()}</p>
              </div>

              {selectedReport.accion_tomada && (
                <div className="detail-section">
                  <h3>Acción Tomada</h3>
                  <p>{selectedReport.accion_tomada}</p>
                </div>
              )}

              {selectedReport.fecha_resolucion && (
                <div className="detail-section">
                  <h3>Fecha de Resolución</h3>
                  <p>{new Date(selectedReport.fecha_resolucion).toLocaleString()}</p>
                </div>
              )}

              {selectedReport.resuelto_por && (
                <div className="detail-section">
                  <h3>Resuelto por</h3>
                  <p>{selectedReport.resuelto_por.username}</p>
                </div>
              )}

              {selectedReport.notas_admin && (
                <div className="detail-section">
                  <h3>Notas Administrativas</h3>
                  <p>{selectedReport.notas_admin}</p>
                </div>
              )}

              {/* Resolution Actions - Only show if report is in review */}
              {selectedReport.estado === 'en_revision' && (
                <div className="detail-section resolution-actions">
                  <h3>Resolver Reporte</h3>
                  <p className="resolution-help">Selecciona la acción a tomar:</p>
                  <div className="resolution-buttons">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleResolve(selectedReport.id, 'ninguna')}
                    >
                      Sin Acción
                    </button>
                    <button
                      className="btn btn-warning btn-sm"
                      onClick={() => handleResolve(selectedReport.id, 'advertencia')}
                    >
                      Advertencia
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleResolve(selectedReport.id, 'suspension')}
                    >
                      Suspender Usuario
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleResolve(selectedReport.id, 'eliminacion')}
                    >
                      Eliminar Usuario
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to show toast notifications
function showToast(message, type = 'info') {
  const event = new CustomEvent('showToast', {
    detail: { message, type }
  });
  window.dispatchEvent(event);
}
