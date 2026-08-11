import React from 'react';
import { Modal } from './Modal';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  isLoading = false,
  children,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="confirm-dialog-body">
        <p className="confirm-message">{message}</p>
        {children}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </button>
          <button
            className={isDanger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
