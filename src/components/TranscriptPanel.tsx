import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { Mic, UploadCloud, Loader2, FileAudio, X } from 'lucide-react';

interface TranscriptPanelProps {
  messages: Message[];
  interim: string;
  searchQuery: string;
  isRecording: boolean;
  isUploading: boolean;
  uploadingFileName?: string;
  pendingFiles: File[];
  onDropFiles: (files: File[]) => void;
  onPanelClick: () => void;
  onRemoveFile: (index: number) => void;
  mode: 'realtime' | 'upload';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TranscriptPanel({
  messages, interim, searchQuery, isRecording,
  isUploading, uploadingFileName,
  pendingFiles, onDropFiles, onPanelClick, onRemoveFile,
  mode,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interim]);

  const filtered = searchQuery
    ? messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // ── Drag & Drop handlers ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (mode === 'upload') {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (mode !== 'upload') return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) {
      onDropFiles(files);
    }
  };

  // ── Render standard panel when there is an active recording OR messages/interim text exist ──
  if (messages.length > 0 || interim || isRecording || isUploading) {
    return (
      <div 
        className={`transcript-panel${isDragging ? ' panel-dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Floating drag overlay when messages exist */}
        {isDragging && (
          <div className="panel-drag-overlay">
            <div className="panel-drag-overlay-box">
              <UploadCloud size={40} className="drag-overlay-icon" />
              <p>Drop files here to stage for transcription</p>
            </div>
          </div>
        )}

        {/* Small floating banner when files are uploaded/staged in a session with existing messages */}
        {mode === 'upload' && pendingFiles.length > 0 && !isUploading && (
          <div className="transcript-uploaded-banner">
            <UploadCloud size={14} className="banner-icon" />
            <span className="banner-text">
              Uploaded files ready ({pendingFiles.length}):
            </span>
            <div className="banner-tags">
              {pendingFiles.map((file, idx) => (
                <div key={idx} className="banner-tag">
                  <FileAudio size={12} className="banner-tag-icon" />
                  <span className="banner-tag-name" title={file.name}>{file.name}</span>
                  <button 
                    className="banner-tag-remove"
                    onClick={() => onRemoveFile(idx)}
                    title="Remove file"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {interim && (
          <div className="interim-bubble">
            <p className="interim-text">{interim}<span className="cursor-blink">|</span></p>
          </div>
        )}

        {isUploading && (
          <div className="upload-inline-processing">
            <Loader2 size={16} className="upload-spinner" />
            <span>Transcribing <em>{uploadingFileName}</em>…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    );
  }

  // ── Render landing states when no transcripts exist ──
  if (mode === 'realtime') {
    return (
      <div className="transcript-empty">
        {isRecording ? (
          <>
            <div className="listening-indicator">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="listening-dot" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <p className="empty-title">Listening…</p>
            <p className="empty-sub">Speak now — your words will appear here</p>
          </>
        ) : (
          <>
            <div className="empty-icon"><Mic size={32} /></div>
            <p className="empty-title">No transcript yet</p>
            <p className="empty-sub">Select a session and click Start Transcribing</p>
          </>
        )}
      </div>
    );
  }

  // mode === 'upload'
  return (
    <div 
      className="transcript-empty"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {pendingFiles.length > 0 ? (
        <div className="file-preview-container">
          <h2 className="file-preview-title">Uploaded Files ({pendingFiles.length}/3)</h2>
          
          <div className="file-preview-list">
            {pendingFiles.map((file, idx) => (
              <div key={idx} className="file-preview-card">
                <div className="file-preview-icon">
                  <FileAudio size={24} />
                </div>
                <div className="file-preview-info">
                  <span className="file-preview-name">{file.name}</span>
                  <span className="file-preview-size">{formatFileSize(file.size)}</span>
                </div>
                <button
                  className="file-preview-remove"
                  onClick={() => onRemoveFile(idx)}
                  title="Remove file"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          <p className="file-preview-hint">
            Uploaded files ready! Click <strong>Start Transcribing</strong> below to begin.
          </p>

          {pendingFiles.length < 3 && (
            <button className="file-preview-swap" onClick={onPanelClick}>
              Add another file
            </button>
          )}
        </div>
      ) : (
        <div 
          className={`transcript-upload-dropbox${isDragging ? ' dragging' : ''}`}
          onClick={onPanelClick}
          style={{ cursor: 'pointer' }}
        >
          <div className="empty-icon"><UploadCloud size={32} /></div>
          <p className="empty-title">Upload Recording</p>
          <p className="empty-sub">Drag & drop files here, or click to browse</p>
        </div>
      )}
    </div>
  );
}
