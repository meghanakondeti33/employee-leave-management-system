import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

export const Profile = () => {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/auth/me');
      setProfile(response.user);
    } catch (err) {
      setError(err.message || 'Failed to load user profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const currentUser = profile || authUser;

  return (
    <div className="page-container max-w-2xl">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Authenticated user profile and system access privileges.</p>
      </div>

      {loading ? (
        <LoadingSpinner message="Fetching user credentials..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchProfile} />
      ) : (
        <div className="card">
          <div className="profile-header">
            <div className="profile-avatar">👤</div>
            <div>
              <h2>{currentUser?.email}</h2>
              <span className={`role-tag role-${currentUser?.role}`}>{currentUser?.role?.toUpperCase()}</span>
            </div>
          </div>

          <div className="profile-details-grid margin-top">
            <div className="profile-detail-item">
              <span className="detail-label">User Identifier (PK):</span>
              <span className="detail-value font-mono">#{currentUser?.id}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Email Address:</span>
              <span className="detail-value">{currentUser?.email}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">System Role:</span>
              <span className="detail-value capitalize">{currentUser?.role}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Authentication Method:</span>
              <span className="detail-value">JWT Bearer Security Token</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
