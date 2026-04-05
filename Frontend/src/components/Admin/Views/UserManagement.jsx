import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { API_BASE } from '../../../config/constants';

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, total_pages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const data = await api(API_BASE, `/admin/users?page=${page}&limit=20`);
      setUsers(data.users || []);
      setPagination(data.pagination || { current_page: 1, total_pages: 1 });
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !user.is_suspended) ||
      (statusFilter === 'suspended' && user.is_suspended);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'superadmin':
        return 'bg-[#ff6a9f] text-white';
      case 'admin':
        return 'bg-[#4967f4] text-white';
      default:
        return 'bg-[#1f2b49] text-[#a3aac4]';
    }
  };

  const getStatusBadgeClass = (isSuspended) => {
    return isSuspended 
      ? 'bg-red-500/20 text-red-400' 
      : 'bg-green-500/20 text-green-400';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) return <div className="p-8 text-[#dee5ff]">Cargando...</div>;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[#dee5ff] text-2xl font-semibold">Gestión de Usuarios</h1>
          <p className="text-[#a3aac4] text-sm mt-2">
            Administra y revisa cuentas de usuario
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-[#141f38] rounded-2xl p-4 space-y-4">
        <input
          type="text"
          placeholder="Buscar por usuario o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#1f2b49] text-[#dee5ff] px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-[#4967f4]"
        />
        
        <div className="flex gap-4">
          {/* Role Filter */}
          <div className="flex-1">
            <label className="text-[#a3aac4] text-xs mb-2 block">Filtrar por Rol</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-[#1f2b49] text-[#dee5ff] px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-[#4967f4]"
            >
              <option value="all">Todos los roles</option>
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex-1">
            <label className="text-[#a3aac4] text-xs mb-2 block">Filtrar por Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#1f2b49] text-[#dee5ff] px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-[#4967f4]"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="suspended">Suspendidos</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {(roleFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setRoleFilter('all');
                  setStatusFilter('all');
                  setSearchTerm('');
                }}
                className="px-4 py-2 bg-[#1f2b49] text-[#dee5ff] rounded-lg hover:bg-[#2a3a5f] flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">clear</span>
                <span>Limpiar</span>
              </button>
            </div>
          )}
        </div>

        {/* Active Filters Summary */}
        {(roleFilter !== 'all' || statusFilter !== 'all') && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#a3aac4]">Filtros activos:</span>
            {roleFilter !== 'all' && (
              <span className="px-3 py-1 bg-[#4967f4]/20 text-[#4967f4] rounded-full text-xs">
                Rol: {roleFilter === 'user' ? 'Usuario' : 'Admin'}
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="px-3 py-1 bg-[#4967f4]/20 text-[#4967f4] rounded-full text-xs">
                Estado: {statusFilter === 'active' ? 'Activos' : 'Suspendidos'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-[#a3aac4] text-sm">
        Mostrando {filteredUsers.length} de {users.length} usuarios
      </div>

      {/* Users Table */}
      <div className="bg-[#141f38] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#1f2b49]">
            <tr>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Usuario</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Email</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Rol</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Estado</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Registro</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Último Login</th>
              <th className="text-left text-[#a3aac4] text-xs font-medium px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-[#a3aac4]">
                  No se encontraron usuarios con los filtros aplicados
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-[#1f2b49]">
                  <td className="px-6 py-4 text-[#dee5ff] text-sm">{user.username}</td>
                  <td className="px-6 py-4 text-[#a3aac4] text-sm">{user.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                        user.is_suspended
                      )}`}
                    >
                      {user.is_suspended ? 'Suspendido' : 'Activo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#a3aac4] text-sm">
                    {formatDate(user.fecha_registro)}
                  </td>
                  <td className="px-6 py-4 text-[#a3aac4] text-sm">
                    {formatDate(user.ultimo_login)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                      className="text-[#4967f4] hover:text-[#99a9ff]"
                    >
                      <span className="material-symbols-outlined text-xl">visibility</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <div className="text-[#a3aac4] text-sm">
          Página {pagination.current_page} de {pagination.total_pages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchUsers(pagination.current_page - 1)}
            disabled={pagination.current_page === 1}
            className="px-4 py-2 bg-[#141f38] text-[#dee5ff] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1f2b49]"
          >
            Anterior
          </button>
          <button
            onClick={() => fetchUsers(pagination.current_page + 1)}
            disabled={pagination.current_page === pagination.total_pages}
            className="px-4 py-2 bg-[#141f38] text-[#dee5ff] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1f2b49]"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
