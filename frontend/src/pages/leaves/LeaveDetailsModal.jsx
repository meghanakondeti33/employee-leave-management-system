import React from 'react';
import { Modal } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';

export const LeaveDetailsModal = ({ isOpen, onClose, request }) => {
  if (!request) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Leave Request #${request.id}`}>
      <div className="leave-details-container">
        <div className="details-header-row">
          <span className="details-policy">{request.leave_policy_name || 'Annual Leave'}</span>
          <StatusBadge status={request.status} />
        </div>

        <div className="details-grid">
          <div className="details-item">
            <span className="details-label">Start Date:</span>
            <span className="details-value">{request.start_date}</span>
          </div>
          <div className="details-item">
            <span className="details-label">End Date:</span>
            <span className="details-value">{request.end_date}</span>
          </div>
          <div className="details-item">
            <span className="details-label">Duration:</span>
            <span className="details-value">{request.days} Day(s)</span>
          </div>
          <div className="details-item">
            <span className="details-label">Submitted On:</span>
            <span className="details-value">{new Date(request.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="details-section">
          <span className="details-label">Reason for Request:</span>
          <p className="details-box">{request.reason}</p>
        </div>

        {request.status === 'rejected' && request.rejection_reason && (
          <div className="details-section alert-danger-box">
            <span className="details-label text-danger">Rejection Reason:</span>
            <p className="details-box text-danger">{request.rejection_reason}</p>
          </div>
        )}

        {request.status === 'approved' && request.approved_at && (
          <div className="details-section alert-success-box">
            <span className="details-label text-success">Approval Timestamp:</span>
            <p className="details-box">{new Date(request.approved_at).toLocaleString()}</p>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
