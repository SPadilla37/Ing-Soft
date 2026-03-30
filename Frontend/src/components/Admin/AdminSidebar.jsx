import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminSidebar = () => {
  const { currentUserRecord, clearSession } = useAuth();

  const navItems = [
    { path: '/admin/dashboard', icon: 'bar_chart', label: 'Estadísticas' },
    { path: '/admin/users', icon: 'group', label: 'Usuarios' },
    { path: '/admin/skills', icon: 'psychology', label: 'Habilidades' },
    { path: '/admin/reports', icon: 'flag', label: 'Reportes' },
  ];

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      clearSession();
    }
  };

  return (
    <div className="w-60 bg-[#0f1930] flex flex-col">
      {/* Logo Area */}
      <div className="h-16 bg-[#141f38] flex items-center gap-3 px-5">
        <span className="material-symbols-outlined text-[#99a9ff] text-2xl">
          admin_panel_settings
        </span>
        <span className="text-[#dee5ff] text-lg font-semibold">Admin Panel</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 h-12 px-4 ${
                isActive
                  ? 'bg-[#4967f4] text-white'
                  : 'text-[#a3aac4] hover:bg-[#141f38]'
              }`
            }
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span className="text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-[#141f38]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[#dee5ff] text-sm font-medium">
              {currentUserRecord?.username}
            </div>
            <div className="text-[#a3aac4] text-xs">
              {currentUserRecord?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#a3aac4] hover:text-[#ff6a9f] transition-colors"
            title="Cerrar sesión"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar;
