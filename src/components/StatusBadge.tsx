import React from 'react';
import type { ConnectionStatus } from '../types';

interface StatusBadgeProps {
  status: ConnectionStatus;
  isRecording: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isRecording }) => {
  const isConnected = status === 'connected';

  return (
    <div className="status-badge">
      <span className={`status-dot ${isConnected ? 'status-dot-connected' : 'status-dot-disconnected'} ${isRecording ? 'animate-pulse-dot' : ''}`} />
      <span className={`status-label ${isConnected ? 'status-label-connected' : 'status-label-disconnected'}`}>
        {isRecording ? 'Recording…' : isConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
};
