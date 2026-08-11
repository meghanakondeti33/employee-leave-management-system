import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';

import { Login } from './pages/Login';

// Dashboards
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { ManagerDashboard } from './pages/manager/ManagerDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';

// Leave Management
import { ApplyLeave } from './pages/leaves/ApplyLeave';
import { MyLeaves } from './pages/leaves/MyLeaves';
import { LeaveApprovals } from './pages/manager/LeaveApprovals';

// Team & Employee Management
import { Team } from './pages/manager/Team';
import { Employees } from './pages/admin/Employees';

// Reports & Auditing
import { Reports } from './pages/admin/Reports';
import { AuditLogs } from './pages/admin/AuditLogs';

// Profile & 404
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';

/**
 * Dynamic Role Dashboard Component
 */
const DashboardRouter = () => {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDashboard />;
  if (user?.role === 'manager') return <ManagerDashboard />;
  return <EmployeeDashboard />;
};

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes wrapped in AppLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardRouter />} />

            {/* Employee Views */}
            <Route path="leaves" element={<MyLeaves />} />
            <Route path="apply-leave" element={<ApplyLeave />} />

            {/* Manager Views */}
            <Route path="team" element={<Team />} />
            <Route path="leave-approvals" element={<LeaveApprovals />} />

            {/* Admin Views */}
            <Route path="employees" element={<Employees />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit-logs" element={<AuditLogs />} />

            {/* Common Views */}
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* 404 Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
