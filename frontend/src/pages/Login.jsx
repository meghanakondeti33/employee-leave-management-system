import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) return;

    setIsSubmitting(true);

    const result = await login(email.trim(), password);

    setIsSubmitting(false);

    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setApiError(result.message || 'Invalid email or password.');
    }
  };

  // Helper for quick filling testing accounts
  const fillCredentials = (userEmail) => {
    setEmail(userEmail);
    setPassword('Password123');
    setErrors({});
    setApiError('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo" aria-hidden="true">🏢</div>
          <h1>LeaveFlow Pro</h1>
          <p>Workforce & Employee Leave Portal</p>
        </div>

        {apiError && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-icon">⚠️</span> {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? 'input-error' : ''}
              disabled={isSubmitting}
              autoComplete="email"
              autoFocus
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.password ? 'input-error' : ''}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="button-spinner"></span> Authenticating...
              </>
            ) : (
              'Sign In to Dashboard'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="demo-credentials-note">Quick Fill Demo Roles:</p>
          <div className="action-buttons margin-top-sm justify-center">
            <button
              type="button"
              className="btn-sm btn-secondary"
              onClick={() => fillCredentials('emp@p7test.com')}
              disabled={isSubmitting}
            >
              Employee
            </button>
            <button
              type="button"
              className="btn-sm btn-secondary"
              onClick={() => fillCredentials('mgr@p7test.com')}
              disabled={isSubmitting}
            >
              Manager
            </button>
            <button
              type="button"
              className="btn-sm btn-secondary"
              onClick={() => fillCredentials('admin@p7test.com')}
              disabled={isSubmitting}
            >
              Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
