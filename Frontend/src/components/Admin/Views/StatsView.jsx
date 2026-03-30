import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { API_BASE } from '../../../config/constants';

const StatsView = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await api(API_BASE, '/admin/stats');
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Actualizar cada 60s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-8 text-[#dee5ff]">Cargando...</div>;

  const statCards = [
    { icon: 'group', label: 'Usuarios Registrados', value: stats?.total_users || 0, color: '#99a9ff' },
    { icon: 'swap_horiz', label: 'Intercambios Realizados', value: stats?.total_exchanges || 0, color: '#4dc9f1' },
    { icon: 'star', label: 'Calificación Promedio', value: stats?.average_rating || 0, color: '#ff6a9f' },
    { icon: 'psychology', label: 'Habilidades Activas', value: stats?.total_skills || 0, color: '#4ade80' },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[#dee5ff] text-2xl font-semibold">Estadísticas del Sitio</h1>
        <p className="text-[#a3aac4] text-sm mt-2">
          Resumen de métricas y actividad de la plataforma
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-[#141f38] rounded-2xl p-5 space-y-3">
            <span className="material-symbols-outlined text-3xl" style={{ color: card.color }}>
              {card.icon}
            </span>
            <div className="text-[#dee5ff] text-3xl font-bold">{card.value}</div>
            <div className="text-[#a3aac4] text-xs">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Chart Section - Placeholder */}
      <div className="bg-[#141f38] rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-[#dee5ff] text-base font-semibold">Actividad Reciente</h2>
          <span className="text-[#a3aac4] text-xs">Últimos 30 días</span>
        </div>
        <div className="h-44 flex items-end justify-between gap-2 px-5">
          {[80, 120, 60, 140, 100, 160, 90].map((height, idx) => (
            <div
              key={idx}
              className="flex-1 bg-[#4967f4] rounded-t-lg"
              style={{ height: `${height}px` }}
            />
          ))}
        </div>
      </div>

      {/* Activity by Category */}
      <div className="bg-[#141f38] rounded-2xl p-6 space-y-4">
        <h2 className="text-[#dee5ff] text-base font-semibold">Actividad por Categoría</h2>
        <div className="space-y-3">
          {['Tecnología', 'Idiomas', 'Arte', 'Deportes'].map((category, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="text-[#a3aac4] text-sm w-24">{category}</div>
              <div className="flex-1 bg-[#1f2b49] rounded-full h-2">
                <div
                  className="bg-[#4967f4] h-2 rounded-full"
                  style={{ width: `${[75, 60, 45, 30][idx]}%` }}
                />
              </div>
              <div className="text-[#dee5ff] text-sm w-12 text-right">
                {[75, 60, 45, 30][idx]}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatsView;
