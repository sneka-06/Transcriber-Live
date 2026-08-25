import React, { useState, useRef, useEffect } from 'react';
import type { Session } from '../types';
import { Plus, MessageSquare, Trash2, Pencil, Check, X, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  loading: boolean;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions, activeSessionId, loading,
  onSelectSession, onNewSession, onDeleteSession, onRenameSession,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const startEdit = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null); // close delete confirm if open
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const confirmEdit = (id: string) => {
    if (editTitle.trim()) onRenameSession(id, editTitle.trim());
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const askDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingId(null); // close edit if open
    setConfirmDeleteId(id); // show inline confirm
  };

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
    onDeleteSession(id);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const getRelativeTime = (session: Session) => {
    const dateStr = session.updatedAt || session.createdAt;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <div className="sidebar-brand">
            <div className="sidebar-icon">
              <MessageSquare size={14} />
            </div>
            <span className="sidebar-label">Sessions</span>
          </div>
          <button id="btn-new-session" onClick={onNewSession} className="btn-new-session" title="New session">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="session-list">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="session-skeleton" />)
        ) : sessions.length === 0 ? (
          <div className="session-empty">
            <MessageSquare size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>No sessions yet</p>
            <p style={{ fontSize: '0.75rem', marginTop: 4, margin: '4px 0 0' }}>Click + to create one</p>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingId === session.id;
            const isConfirmingDelete = confirmDeleteId === session.id;

            return (
              <div
                key={session.id}
                onClick={() => !isEditing && !isConfirmingDelete && onSelectSession(session.id)}
                className={`session-item${isActive ? ' active' : ''}`}
              >
                {/* ── Rename mode ── */}
                {isEditing ? (
                  <div className="session-edit-row" onClick={e => e.stopPropagation()}>
                    <input
                      ref={inputRef}
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') confirmEdit(session.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="session-edit-input"
                    />
                    <button onClick={() => confirmEdit(session.id)} className="btn-confirm-edit" title="Save">
                      <Check size={13} />
                    </button>
                    <button onClick={cancelEdit} className="btn-cancel-edit" title="Cancel">
                      <X size={13} />
                    </button>
                  </div>

                /* ── Delete confirm mode ── */
                ) : isConfirmingDelete ? (
                  <div className="session-delete-confirm" onClick={e => e.stopPropagation()}>
                    <span className="session-delete-label">Delete?</span>
                    <button onClick={e => confirmDelete(e, session.id)} className="btn-confirm-edit" title="Yes, delete">
                      <Check size={13} />
                    </button>
                    <button onClick={cancelDelete} className="btn-cancel-edit" title="Cancel">
                      <X size={13} />
                    </button>
                  </div>

                /* ── Normal mode ── */
                ) : (
                  <div className="session-item-body">
                    <div className="session-item-left">
                      <p className={`session-title${isActive ? ' active' : ''}`}>{session.title}</p>
                      <div className="session-meta">
                        <Clock size={10} style={{ flexShrink: 0, color: '#6b6f8d' }} />
                        <span className="session-time">{getRelativeTime(session)}</span>
                      </div>
                    </div>
                    <div className="session-actions">
                      <button onClick={e => startEdit(session, e)} className="btn-session-action" title="Rename">
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={e => askDelete(e, session.id)}
                        className="btn-session-action btn-session-delete"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
