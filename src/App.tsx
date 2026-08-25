import { useEffect, useRef, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TranscriptPanel } from './components/TranscriptPanel';
import { ControlBar } from './components/ControlBar';
import { useRecorder } from './hooks/useRecorder';
import { useSessions } from './hooks/useSessions';
import { socket } from './services/socket';
import { fetchMessages, clearMessages as clearMessagesApi } from './services/api';
import type { Message, ConnectionStatus } from './types';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | undefined>();

  // Transcription mode dropdown state: 'realtime' or 'upload'
  const [mode, setMode] = useState<'realtime' | 'upload'>('realtime');

  // Files chosen by user but NOT yet transcribed (up to 3)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Hidden file input for Browse mode
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    startRecording, stopRecording, isRecording,
    isSystemRecording,
  } = useRecorder();

  const {
    sessions, loading, activeSessionId, setActiveSessionId,
    createNewSession, removeSession, renameSession,
  } = useSessions();

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;

  // Track socket connection status
  useEffect(() => {
    const onConnect = () => setConnectionStatus('connected');
    const onDisconnect = () => setConnectionStatus('disconnected');
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnectionStatus('connected');
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // When session changes — join backend session and load history
  useEffect(() => {
    setMessages([]);
    setPartialTranscript('');
    if (!activeSessionId) return;

    socket.emit('join-session', Number(activeSessionId));

    fetchMessages(Number(activeSessionId))
      .then((data: any[]) => {
        const mapped: Message[] = data.map((m: any) => ({
          id: m.id,
          sessionId: m.sessionId,
          speaker: m.speaker,
          text: m.text,
          createdAt: m.createdAt,
        }));
        setMessages(mapped);
      })
      .catch(err => console.error('Failed to fetch messages:', err));
  }, [activeSessionId]);

  // Socket event listeners
  useEffect(() => {
    const handleMessage = (data: any) => {
      if (typeof data !== 'object' || !data.text) return;
      setPartialTranscript('');
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data as Message];
      });
    };

    const handleUpdateMessage = (data: any) => {
      setMessages(prev => prev.map(msg => msg.id === data.id ? { ...msg, text: data.text } : msg));
    };

    const handlePartial = (data: string) => setPartialTranscript(data);
    const handleSystemPartial = (data: string) => setPartialTranscript('[Others] ' + data);

    const handleUploadDone = (data: any) => {
      if (data?.empty) {
        setError('No speech detected in the uploaded file. Try a different audio/video file.');
      }
    };

    socket.on('message', handleMessage);
    socket.on('update-message', handleUpdateMessage);
    socket.on('partial', handlePartial);
    socket.on('system-partial', handleSystemPartial);
    socket.on('upload-done', handleUploadDone);

    return () => {
      socket.off('message', handleMessage);
      socket.off('update-message', handleUpdateMessage);
      socket.off('partial', handlePartial);
      socket.off('system-partial', handleSystemPartial);
      socket.off('upload-done', handleUploadDone);
    };
  }, []);

  // Auto-dismiss errors
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setPartialTranscript('');
    if (activeSessionId) {
      try {
        await clearMessagesApi(Number(activeSessionId));
      } catch (err) {
        console.error('Failed to clear messages from DB:', err);
      }
    }
  }, [activeSessionId]);

  // Start recording — auto-creates a session if none exists
  const handleStartRecording = useCallback(async () => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      const newSession = await createNewSession();
      if (!newSession) {
        setError('Could not create a session. Please try again.');
        return;
      }
      sessionId = newSession.id;
      socket.emit('join-session', Number(sessionId));
    }
    startRecording();
  }, [activeSessionId, createNewSession, startRecording]);

  // Actually send the files sequentially to the backend and transcribe them
  const handleFileUploadQueue = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const newSession = await createNewSession();
      if (!newSession) {
        setError('Could not create a session. Please try again.');
        return;
      }
      sessionId = newSession.id;
      socket.emit('join-session', Number(sessionId));
    }

    setIsUploading(true);
    setPendingFiles([]); // clear all staged previews as we are now processing them

    for (const file of files) {
      setUploadingFileName(file.name);
      
      // Set safety timeout per file
      const fileTimeout = setTimeout(() => {
        setError(`Transcription timed out for ${file.name}.`);
      }, 3 * 60 * 1000);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', String(sessionId));
        formData.append('socketId', socket.id ?? '');

        const res = await fetch('http://localhost:3000/upload', {
          method: 'POST',
          body: formData,
        });

        clearTimeout(fileTimeout);

        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? `Upload failed for ${file.name}.`);
        }
      } catch (err) {
        clearTimeout(fileTimeout);
        console.error('Upload error:', err);
        setError(`Upload failed for ${file.name}. Check your connection.`);
      }
    }
    
    setIsUploading(false);
    setUploadingFileName(undefined);
  }, [activeSessionId, createNewSession]);

  // User picked files — store them up to 3 maximum
  const handleFilesChosen = useCallback((newFiles: File[]) => {
    setPendingFiles(prev => {
      const combined = [...prev];
      let limitExceeded = false;
      for (const file of newFiles) {
        if (combined.length < 3) {
          combined.push(file);
        } else {
          limitExceeded = true;
        }
      }
      if (limitExceeded) {
        setError('You can stage up to 3 files at a time.');
      }
      return combined;
    });
  }, []);

  // Remove the pending file by index
  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Unified Start Transcribing handler:
  // - If `'upload'` mode is selected and files are staged → upload & transcribe all of them
  // - Otherwise → trigger live recording
  const handleStartTranscribing = useCallback(() => {
    if (mode === 'upload' && pendingFiles.length > 0) {
      handleFileUploadQueue(pendingFiles);
    } else {
      handleStartRecording();
    }
  }, [mode, pendingFiles, handleFileUploadQueue, handleStartRecording]);

  // Opens the file picker directly (used by drop zone click or control bar Upload button)
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="app-layout">
      {/* Hidden file input — owned at App level */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) handleFilesChosen(files);
          e.target.value = '';
        }}
      />

      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        loading={loading}
        onSelectSession={setActiveSessionId}
        onNewSession={createNewSession}
        onDeleteSession={removeSession}
        onRenameSession={renameSession}
      />

      <div className="main-area">
        <TopBar
          session={activeSession}
          connectionStatus={connectionStatus}
          isRecording={isRecording}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {error && (
          <div className="error-toast" onClick={() => setError(null)}>
            ⚠️ {error}
          </div>
        )}

        <TranscriptPanel
          messages={messages}
          interim={partialTranscript}
          searchQuery={searchQuery}
          isRecording={isRecording || isSystemRecording}
          isUploading={isUploading}
          uploadingFileName={uploadingFileName}
          pendingFiles={pendingFiles}
          onDropFiles={handleFilesChosen}
          onPanelClick={handleBrowseClick}
          onRemoveFile={handleRemoveFile}
          mode={mode}
        />

        <ControlBar
          isRecording={isRecording}
          isSystemRecording={isSystemRecording}
          onStart={handleStartTranscribing}
          onStop={stopRecording}
          onClear={clearMessages}
          messages={messages}
          sessionId={activeSessionId}
          onUploadClick={handleBrowseClick}
          hasPendingFile={pendingFiles.length > 0}
          isUploading={isUploading}
          uploadingFileName={uploadingFileName}
          mode={mode}
          onChangeMode={setMode}
        />
      </div>
    </div>
  );
}

export default App;