import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState('');

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'employee',
    firstName: '',
    lastName: '',
    employeeCode: '',
    departmentId: '1',
    managerId: '',
    joiningDate: new Date().toISOString().split('T')[0],
  });

  const fetchEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/employees');
      setEmployees(response.employees || []);
    } catch (err) {
      setError(err.message || 'Failed to load employee records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      role: 'employee',
      firstName: '',
      lastName: '',
      employeeCode: '',
      departmentId: '1',
      managerId: '',
      joiningDate: new Date().toISOString().split('T')[0],
    });
    setModalError('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (emp) => {
    resetForm();
    setFormData({
      email: emp.email || '',
      password: '',
      role: emp.role || 'employee',
      firstName: emp.first_name || '',
      lastName: emp.last_name || '',
      employeeCode: emp.employee_code || '',
      departmentId: String(emp.department_id || 1),
      managerId: emp.manager_id ? String(emp.manager_id) : '',
      joiningDate: emp.joining_date || '',
    });
    setEditingEmployee(emp);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError('');
    try {
      await api.post('/employees', {
        email: formData.email,
        password: formData.password,
        role: formData.role,
        firstName: formData.firstName,
        lastName: formData.lastName,
        employeeCode: formData.employeeCode,
        departmentId: parseInt(formData.departmentId, 10),
        managerId: formData.managerId ? parseInt(formData.managerId, 10) : null,
        joiningDate: formData.joiningDate,
      });

      setFeedback(`Employee '${formData.firstName} ${formData.lastName}' created successfully!`);
      setIsCreateOpen(false);
      await fetchEmployees();
    } catch (err) {
      setModalError(err.message || 'Failed to create employee.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setActionLoading(true);
    setModalError('');
    try {
      await api.put(`/employees/${editingEmployee.id}`, {
        email: formData.email,
        role: formData.role,
        firstName: formData.firstName,
        lastName: formData.lastName,
        departmentId: parseInt(formData.departmentId, 10),
        managerId: formData.managerId ? parseInt(formData.managerId, 10) : null,
        joiningDate: formData.joiningDate,
      });

      setFeedback(`Employee profile updated successfully!`);
      setEditingEmployee(null);
      await fetchEmployees();
    } catch (err) {
      setModalError(err.message || 'Failed to update employee profile.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEmployee) return;
    setActionLoading(true);
    try {
      await api.delete(`/employees/${deletingEmployee.id}`);
      setFeedback(`Employee '${deletingEmployee.first_name} ${deletingEmployee.last_name}' deleted.`);
      setDeletingEmployee(null);
      await fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to delete employee.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (emp.first_name && emp.first_name.toLowerCase().includes(q)) ||
      (emp.last_name && emp.last_name.toLowerCase().includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q)) ||
      (emp.employee_code && emp.employee_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div>
          <h1>Employee Management</h1>
          <p>Create, update, and manage organization workforce records.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreate}>
          ➕ Add New Employee
        </button>
      </div>

      {feedback && (
        <div className="alert alert-success margin-bottom" role="alert">
          <span>✅ {feedback}</span>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetchEmployees} />}

      <div className="card">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="🔍 Search by name, email, or employee code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {loading ? (
          <LoadingSpinner message="Loading employee directory..." />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState title="No Employees Found" message="No records match your search criteria." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Manager</th>
                  <th>Role</th>
                  <th>Joining Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="font-mono">{emp.employee_code}</td>
                    <td className="font-weight-600">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td>{emp.email}</td>
                    <td>{emp.department_name}</td>
                    <td>{emp.manager_name || 'N/A'}</td>
                    <td>
                      <span className={`role-tag role-${emp.role}`}>{emp.role}</span>
                    </td>
                    <td>{emp.joining_date}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-sm btn-secondary" onClick={() => handleOpenEdit(emp)}>
                          Edit
                        </button>
                        <button className="btn-sm btn-danger-outline" onClick={() => setDeletingEmployee(emp)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Employee">
        <form onSubmit={handleCreateSubmit}>
          {modalError && (
            <div className="alert alert-danger" role="alert">
              <span>⚠️ {modalError}</span>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                required
                placeholder="Initial password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Employee Code</label>
              <input
                type="text"
                required
                placeholder="EMP-100"
                value={formData.employeeCode}
                onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Department ID</label>
              <input
                type="number"
                required
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Manager Employee ID (Optional)</label>
              <input
                type="number"
                placeholder="Manager ID"
                value={formData.managerId}
                onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Joining Date</label>
            <input
              type="date"
              required
              value={formData.joiningDate}
              onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={actionLoading}>
              {actionLoading ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      {editingEmployee && (
        <Modal
          isOpen={!!editingEmployee}
          onClose={() => setEditingEmployee(null)}
          title={`Edit Employee #${editingEmployee.id}`}
        >
          <form onSubmit={handleEditSubmit}>
            {modalError && (
              <div className="alert alert-danger" role="alert">
                <span>⚠️ {modalError}</span>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Department ID</label>
                <input
                  type="number"
                  required
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Manager Employee ID (Optional)</label>
                <input
                  type="number"
                  placeholder="Manager ID"
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditingEmployee(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deletingEmployee && (
        <ConfirmDialog
          isOpen={!!deletingEmployee}
          onClose={() => setDeletingEmployee(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Employee Record"
          message={`Are you sure you want to delete employee record for ${deletingEmployee.first_name} ${deletingEmployee.last_name} (${deletingEmployee.employee_code})? This will unassign team reports and remove their user account.`}
          confirmText="Yes, Delete Record"
          isDanger={true}
          isLoading={actionLoading}
        />
      )}
    </div>
  );
};
