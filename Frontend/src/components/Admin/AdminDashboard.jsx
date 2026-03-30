import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import StatsView from './Views/StatsView';
import UserManagement from './Views/UserManagement';
import UserDetail from './Views/UserDetail';
import SkillManagement from './Views/SkillManagement';
import ReportsView from './Views/ReportsView';
import { useAuth } from '../../context/AuthContext';

const AdminDashboard = () => {
  const { currentUserRecord } = useAuth();
  
  // Verificar que el usuario tenga rol admin o superadmin
  if (!currentUserRecord || !['admin', 'superadmin'].includes(currentUserRecord.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-screen bg-[#060e20]">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dashboard" element={<StatsView />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/users/:userId" element={<UserDetail />} />
          <Route path="/skills" element={<SkillManagement />} />
          <Route path="/reports" element={<ReportsView />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminDashboard;
