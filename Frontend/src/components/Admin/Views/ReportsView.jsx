import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { API_BASE } from '../../../config/constants';

const ReportsView = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = '/admin/reports/activity';
      const params = [];
      if (startDate) params.push(`start_date=${startDate}`);
      if (endDate) params.push(`end_date=${endDate}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const data = await api(API_BASE, url);
      setReportData(data);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set default dates (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate]);

  const handleExportCSV = () => {
    if (!reportData) return;

    const csvContent = [
      ['Fecha', 'Nuevos Usuarios', 'Intercambios'],
      ...reportData.daily_data.map((day) => [
        day.date,
        day.new_users,
        day.exchanges,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_actividad_${startDate}_${endDate}.csv`;
    a.click();
  };

  if (loading) return <div className="p-8 text-[#dee5ff]">Cargando...</div>;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[#dee5ff] text-2xl font-semibold">Reportes de Actividad</h1>
          <p className="text-[#a3aac4] text-sm mt-2">
            Analiza tendencias y patrones de uso de la plataforma
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-[#4967f4] text-white rounded-lg hover:bg-[#99a9ff] flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-xl">download</span>
          <span>Exportar CSV</span>
        </button>
      </div>

      {/* Date Range Selectors */}
      <div className="bg-[#141f38] rounded-2xl p-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-[#a3aac4] text-sm">Desde:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 bg-[#1f2b49] text-[#dee5ff] rounded-lg outline-none focus:ring-2 focus:ring-[#4967f4]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[#a3aac4] text-sm">Hasta:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 bg-[#1f2b49] text-[#dee5ff] rounded-lg outline-none focus:ring-2 focus:ring-[#4967f4]"
          />
        </div>
      </div>

      {/* Summary Metrics */}
      {reportData && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#141f38] rounded-2xl p-6 space-y-2">
              <div className="text-[#a3aac4] text-xs">Nuevos Usuarios</div>
              <div className="text-[#dee5ff] text-3xl font-bold">
                {reportData.summary.new_users}
              </div>
            </div>
            <div className="bg-[#141f38] rounded-2xl p-6 space-y-2">
              <div className="text-[#a3aac4] text-xs">Intercambios Creados</div>
              <div className="text-[#dee5ff] text-3xl font-bold">
                {reportData.summary.exchanges_created}
              </div>
            </div>
            <div className="bg-[#141f38] rounded-2xl p-6 space-y-2">
              <div className="text-[#a3aac4] text-xs">Intercambios Completados</div>
              <div className="text-[#dee5ff] text-3xl font-bold">
                {reportData.summary.exchanges_completed}
              </div>
            </div>
          </div>

          {/* Line Chart - Placeholder */}
          <div className="bg-[#141f38] rounded-2xl p-6 space-y-4">
            <h2 className="text-[#dee5ff] text-base font-semibold">Evolución Temporal</h2>
            <div className="h-64 flex items-end justify-between gap-1">
              {reportData.daily_data.slice(0, 30).map((day, idx) => {
                const maxValue = Math.max(
                  ...reportData.daily_data.map((d) => d.new_users + d.exchanges)
                );
                const height = ((day.new_users + day.exchanges) / maxValue) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-[#4967f4] rounded-t-lg"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.new_users} usuarios, ${day.exchanges} intercambios`}
                  />
                );
              })}
            </div>
          </div>

          {/* Daily Breakdown Table */}
          <div className="bg-[#141f38] rounded-2xl overflow-hidden">
            <div className="p-6">
              <h2 className="text-[#dee5ff] text-base font-semibold">Desglose Diario</h2>
            </div>
            <table className="w-full">
              <thead className="bg-[#1f2b49]">
                <tr>
                  <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Fecha</th>
                  <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">
                    Nuevos Usuarios
                  </th>
                  <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">
                    Intercambios
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.daily_data.map((day, idx) => (
                  <tr key={idx} className="border-t border-[#1f2b49]">
                    <td className="px-6 py-4 text-[#dee5ff] text-sm">{day.date}</td>
                    <td className="px-6 py-4 text-[#a3aac4] text-sm">{day.new_users}</td>
                    <td className="px-6 py-4 text-[#a3aac4] text-sm">{day.exchanges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsView;
