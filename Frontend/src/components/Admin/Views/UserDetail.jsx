import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import { useAuth } from '../../../context/AuthContext';

const UserDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUserRecord } = useAuth();
  const [userDetail, setUserDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [alert, setAlert] = useState(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showUnsuspendDialog, setShowUnsuspendDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const fetchUserDetail = async () => {
    setLoading(true);
    try {
      const data = await api(API_BASE, `/admin/users/${userId}`);
      setUserDetail(data);
      setSelectedRole(data.user?.role || 'user');
    } catch (error) {
      console.error('Error fetching user detail:', error);
      setAlert({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetail();
  }, [userId]);

  const handleRoleChange = async () => {
    try {
      await api(API_BASE, `/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: selectedRole }),
      });
      setAlert({ type: 'success', message: 'Rol actualizado exitosamente' });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    }
  };

  const handleSuspend = async () => {
    try {
      await api(API_BASE, `/admin/users/${userId}/suspend`, {
        method: 'PATCH',
      });
      setAlert({ type: 'success', message: 'Cuenta suspendida exitosamente' });
      setShowSuspendDialog(false);
      fetchUserDetail();
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
      setShowSuspendDialog(false);
    }
  };

  const handleUnsuspend = async () => {
    try {
      await api(API_BASE, `/admin/users/${userId}/unsuspend`, {
        method: 'PATCH',
      });
      setAlert({ type: 'success', message: 'Cuenta reactivada exitosamente' });
      setShowUnsuspendDialog(false);
      fetchUserDetail();
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
      setShowUnsuspendDialog(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api(API_BASE, `/admin/users/${userId}`, {
        method: 'DELETE',
      });
      setAlert({ type: 'success', message: 'Cuenta eliminada exitosamente' });
      setTimeout(() => {
        navigate('/admin/users');
      }, 1500);
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
      setShowDeleteDialog(false);
    }
  };

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  if (loading) return <div className="p-8 text-[#dee5ff]">Cargando...</div>;
  if (!userDetail) return <div className="p-8 text-[#dee5ff]">Usuario no encontrado</div>;

  const { user, stats, skills } = userDetail;

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

      {/* Back Button */}
      <button
        onClick={() => navigate('/admin/users')}
        className="flex items-center gap-2 text-[#4967f4] hover:text-[#99a9ff]"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        <span>Volver a usuarios</span>
      </button>

      {/* User Profile Card */}
      <div className="bg-[#141f38] rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-[#1f2b49] flex items-center justify-center overflow-hidden">
            {user.foto_url ? (
              <img src={user.foto_url} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-5xl text-[#a3aac4]">person</span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-[#dee5ff] text-2xl font-semibold">
              {user.nombre} {user.apellido}
            </h1>
            <p className="text-[#a3aac4] text-sm">@{user.username}</p>
            <p className="text-[#a3aac4] text-sm">{user.email}</p>
            {user.biografia && (
              <p className="text-[#dee5ff] text-sm mt-3">{user.biografia}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-[#141f38] rounded-2xl p-4 space-y-2">
          <div className="text-[#a3aac4] text-xs">Intercambios Enviados</div>
          <div className="text-[#dee5ff] text-2xl font-bold">{stats.exchanges_sent}</div>
        </div>
        <div className="bg-[#141f38] rounded-2xl p-4 space-y-2">
          <div className="text-[#a3aac4] text-xs">Recibidos</div>
          <div className="text-[#dee5ff] text-2xl font-bold">{stats.exchanges_received}</div>
        </div>
        <div className="bg-[#141f38] rounded-2xl p-4 space-y-2">
          <div className="text-[#a3aac4] text-xs">Completados</div>
          <div className="text-[#dee5ff] text-2xl font-bold">{stats.exchanges_completed}</div>
        </div>
        <div className="bg-[#141f38] rounded-2xl p-4 space-y-2">
          <div className="text-[#a3aac4] text-xs">Reseñas</div>
          <div className="text-[#dee5ff] text-2xl font-bold">{stats.reviews_count}</div>
        </div>
        <div className="bg-[#141f38] rounded-2xl p-4 space-y-2">
          <div className="text-[#a3aac4] text-xs">Calificación</div>
          <div className="text-[#dee5ff] text-2xl font-bold">{stats.average_rating}</div>
        </div>
      </div>

      {/* Skills */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#141f38] rounded-2xl p-6 space-y-4">
          <h2 className="text-[#dee5ff] text-base font-semibold">Habilidades Ofertadas</h2>
          <div className="flex flex-wrap gap-2">
            {skills.offered.map((skill) => (
              <span
                key={skill.id}
                className="px-3 py-1 bg-[#1f2b49] text-[#dee5ff] text-sm rounded-full"
              >
                {skill.nombre}
              </span>
            ))}
            {skills.offered.length === 0 && (
              <span className="text-[#a3aac4] text-sm">Sin habilidades ofertadas</span>
            )}
          </div>
        </div>
        <div className="bg-[#141f38] rounded-2xl p-6 space-y-4">
          <h2 className="text-[#dee5ff] text-base font-semibold">Habilidades Buscadas</h2>
          <div className="flex flex-wrap gap-2">
            {skills.wanted.map((skill) => (
              <span
                key={skill.id}
                className="px-3 py-1 bg-[#1f2b49] text-[#dee5ff] text-sm rounded-full"
              >
                {skill.nombre}
              </span>
            ))}
            {skills.wanted.length === 0 && (
              <span className="text-[#a3aac4] text-sm">Sin habilidades buscadas</span>
            )}
          </div>
        </div>
      </div>

      {/* Suspension Status Indicator */}
      {userDetail?.user?.is_suspended && (
        <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded-lg flex items-center gap-2">
          <span className="material-symbols-outlined">block</span>
          <span>Cuenta Suspendida</span>
        </div>
      )}

      {/* Admin Actions */}
      {(currentUserRecord?.role === 'admin' || currentUserRecord?.role === 'superadmin') && (
        <div className="bg-[#141f38] rounded-2xl p-6 space-y-4">
          <h2 className="text-[#dee5ff] text-base font-semibold">Acciones Administrativas</h2>
          
          {/* Info box about deletion process */}
          {currentUserRecord?.role === 'superadmin' && !userDetail?.user?.is_suspended && (
            <div className="bg-blue-500/20 text-blue-400 px-4 py-3 rounded-lg text-sm">
              <p className="font-medium mb-1">ℹ️ Proceso de eliminación</p>
              <p className="text-xs">
                Para eliminar una cuenta, primero debes suspenderla. Al suspender, todos los intercambios activos se cancelarán automáticamente.
              </p>
            </div>
          )}
          
          <div className="flex items-center gap-4">
            {!userDetail?.user?.is_suspended ? (
              <button
                onClick={() => setShowSuspendDialog(true)}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Suspender Cuenta
              </button>
            ) : (
              <button
                onClick={() => setShowUnsuspendDialog(true)}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Reactivar Cuenta
              </button>
            )}
            
            {currentUserRecord?.role === 'superadmin' && (
              <button
                onClick={() => setShowDeleteDialog(true)}
                className={`px-6 py-2 rounded-lg ${
                  userDetail?.user?.is_suspended
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-50'
                }`}
              >
                Eliminar Cuenta
              </button>
            )}
          </div>
        </div>
      )}

      {/* Suspend Confirmation Dialog */}
      {showSuspendDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#141f38] rounded-2xl p-6 max-w-md">
            <h3 className="text-[#dee5ff] text-lg font-semibold mb-4">
              ¿Suspender cuenta?
            </h3>
            <p className="text-[#a3aac4] mb-4">
              El usuario no podrá iniciar sesión hasta que se reactive su cuenta.
            </p>
            {(stats.exchanges_sent > 0 || stats.exchanges_received > 0) && (
              <div className="bg-orange-500/20 text-orange-400 px-4 py-3 rounded-lg mb-4">
                <p className="text-sm font-medium mb-1">⚠️ Intercambios activos</p>
                <p className="text-xs">
                  Todos los intercambios pendientes o aceptados serán cancelados automáticamente.
                </p>
              </div>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => setShowSuspendDialog(false)}
                className="flex-1 px-4 py-2 bg-[#1f2b49] text-[#dee5ff] rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSuspend}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg"
              >
                Suspender
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsuspend Confirmation Dialog */}
      {showUnsuspendDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#141f38] rounded-2xl p-6 max-w-md">
            <h3 className="text-[#dee5ff] text-lg font-semibold mb-4">
              ¿Reactivar cuenta?
            </h3>
            <p className="text-[#a3aac4] mb-6">
              El usuario podrá iniciar sesión nuevamente.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowUnsuspendDialog(false)}
                className="flex-1 px-4 py-2 bg-[#1f2b49] text-[#dee5ff] rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleUnsuspend}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg"
              >
                Reactivar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#141f38] rounded-2xl p-6 max-w-md">
            <h3 className="text-[#dee5ff] text-lg font-semibold mb-4">
              ⚠️ ¿Eliminar cuenta permanentemente?
            </h3>
            
            {!userDetail?.user?.is_suspended ? (
              <div className="space-y-4">
                <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg">
                  <p className="text-sm font-medium mb-1">❌ Acción no permitida</p>
                  <p className="text-xs">
                    Debes suspender la cuenta antes de poder eliminarla.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  className="w-full px-4 py-2 bg-[#1f2b49] text-[#dee5ff] rounded-lg"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[#a3aac4]">
                  Esta acción no se puede deshacer. Todos los datos del usuario serán eliminados permanentemente.
                </p>
                <div className="bg-yellow-500/20 text-yellow-400 px-4 py-3 rounded-lg">
                  <p className="text-xs">
                    Se eliminarán: conversaciones, mensajes, reseñas, intercambios y habilidades del usuario.
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowDeleteDialog(false)}
                    className="flex-1 px-4 py-2 bg-[#1f2b49] text-[#dee5ff] rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role Change (SuperAdmin Only) */}
      {currentUserRecord?.role === 'superadmin' && (
        <div className="bg-[#141f38] rounded-2xl p-6 space-y-4">
          <h2 className="text-[#dee5ff] text-base font-semibold">Cambiar Rol</h2>
          <div className="flex items-center gap-4">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-4 py-2 bg-[#1f2b49] text-[#dee5ff] rounded-lg outline-none focus:ring-2 focus:ring-[#4967f4]"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="superadmin">SuperAdmin</option>
            </select>
            <button
              onClick={handleRoleChange}
              disabled={selectedRole === user.role}
              className="px-6 py-2 bg-[#4967f4] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#99a9ff]"
            >
              Actualizar Rol
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetail;
