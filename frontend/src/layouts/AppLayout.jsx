import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const role = user?.role || 'employee';

  const navItemsByRole = {
    employee: [
      { path: '/dashboard', label: 'Dashboard', icon: '📊' },
      { path: '/leaves', label: 'My Leaves', icon: '📅' },
      { path: '/apply-leave', label: 'Apply Leave', icon: '➕' },
      { path: '/profile', label: 'Profile', icon: '👤' },
    ],
    manager: [
      { path: '/dashboard', label: 'Dashboard', icon: '📊' },
      { path: '/team', label: 'My Team', icon: '👥' },
      { path: '/leave-approvals', label: 'Leave Approvals', icon: '✅' },
      { path: '/profile', label: 'Profile', icon: '👤' },
    ],
    admin: [
      { path: '/dashboard', label: 'Dashboard', icon: '📊' },
      { path: '/employees', label: 'Employees', icon: '👥' },
      { path: '/reports', label: 'Reports', icon: '📈' },
      { path: '/audit-logs', label: 'Audit Logs', icon: '🛡️' },
      { path: '/profile', label: 'Profile', icon: '👤' },
    ],
  };

  const navItems = navItemsByRole[role] || navItemsByRole.employee;

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-logo">🏢</span>
          <span className="brand-title">LeaveFlow Pro</span>
          <span className="brand-subtitle">Workforce System</span>
        </div>

        <div className="header-user">
          <div className="user-info-badge">
            <span className="user-email">{user?.email}</span>
            <span className={`role-tag role-${role}`}>{role.toUpperCase()}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Sign Out">
            <span className="logout-icon">🚪</span> Sign Out
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <aside className="app-sidebar">
          <nav className="sidebar-nav">
            <div className="nav-section-title">Main Menu</div>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="system-status">
              <span className="status-dot"></span> API Server Connected
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
