import React, { useRef } from 'react';
import { Search, X, Radio } from 'lucide-react';
import type { Session, ConnectionStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface TopBarProps {
  session: Session | null;
  connectionStatus: ConnectionStatus;
  isRecording: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  session, connectionStatus, isRecording, searchQuery, onSearchChange,
}) => {
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <header className="top-bar">
      <div className="top-bar-brand">
        <div className="brand-icon">
          <Radio size={16} />
        </div>
        <span className="brand-name">LiveTranscriber</span>
      </div>

      <div className="top-bar-divider" />

      <div className="top-bar-session">
        {session
          ? <p className="session-active-title">{session.title}</p>
          : <p className="session-inactive-title">No session selected</p>}
      </div>

      {/* Clicking the search icon focuses the input */}
      <div className="search-wrapper" onClick={() => searchRef.current?.focus()}>
        <Search size={14} className="search-icon" />
        <input
          ref={searchRef}
          id="input-search"
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search transcript..."
          className="search-input"
        />
        {searchQuery && (
          <button
            onClick={e => { e.stopPropagation(); onSearchChange(''); }}
            className="search-clear"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <StatusBadge status={connectionStatus} isRecording={isRecording} />
    </header>
  );
};
