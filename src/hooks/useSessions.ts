import { useState, useEffect, useCallback } from 'react';
import type { Session } from '../types';
import {
  fetchSessions,
  createSession,
  deleteSession,
  renameSession,
} from '../services/api';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await fetchSessions();
      const mapped: Session[] = data.map((s: any) => ({
        id: String(s.id),
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
      setSessions(mapped);
      if (mapped.length > 0) {
        setActiveSessionId(mapped[0].id);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createNewSession = useCallback(async () => {
    try {
      const now = new Date();
      const title = `Session – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      const data = await createSession(title);
      const session: Session = {
        id: String(data.id),
        title: data.title,
        createdAt: data.createdAt,
        updatedAt: new Date().toISOString(),
      };
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
      return session;
    } catch (err) {
      console.error('Failed to create session:', err);
      return null;
    }
  }, []);

  const removeSession = useCallback(async (id: string) => {
    try {
      await deleteSession(Number(id));
      setSessions(prev => {
        const filtered = prev.filter(s => s.id !== id);
        if (filtered.length > 0) {
          setActiveSessionId(current => current === id ? filtered[0].id : current);
        } else {
          setActiveSessionId(null);
        }
        return filtered;
      });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, []);

  const renameSessionFn = useCallback(async (id: string, title: string) => {
    try {
      await renameSession(Number(id), title);
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  }, []);

  return {
    sessions,
    loading,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    removeSession,
    renameSession: renameSessionFn,
  };
}
