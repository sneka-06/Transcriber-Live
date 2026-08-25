import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Download, Trash2, Upload, Loader2, ChevronDown } from 'lucide-react';
import type { Message } from '../types';

interface ControlBarProps {
  isRecording: boolean;
  isSystemRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  messages: Message[];
  sessionId: string | null;
  onUploadClick: () => void;
  hasPendingFile: boolean;
  isUploading: boolean;
  uploadingFileName?: string;
  mode: 'realtime' | 'upload';
  onChangeMode: (mode: 'realtime' | 'upload') => void;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function ControlBar({
  isRecording, isSystemRecording,
  onStart, onStop,
  onClear, messages, sessionId,
  onUploadClick,
  hasPendingFile,
  isUploading, uploadingFileName,
  mode, onChangeMode,
}: ControlBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside listener to close the dropdown menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isRecording && !isSystemRecording) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording, isSystemRecording]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  function exportTxt() {
    const lines = messages.map(m => `[${m.createdAt}] ${m.speaker}: ${m.text}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transcript-session-${sessionId ?? 'unknown'}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="control-bar-wrapper">



      {/* ── Uploading strip (File transcription active) ── */}
      {isUploading && (
        <div className="pending-file-strip pending-file-strip--uploading">
          <div className="pending-file-strip-left">
            <Loader2 size={14} className="upload-spinner" />
            <span className="pending-file-strip-name">Transcribing...</span>
            {uploadingFileName && (
              <span className="pending-file-strip-size">{uploadingFileName}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Main control bar ── */}
      <div className="control-bar">
        {/* Left — waveform */}
        <div className="waveform-bars">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`waveform-bar${isRecording || isSystemRecording ? ' active' : ''}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        {/* Center */}
        <div className="control-center">
          <div className="mode-controls-wrapper">
            {isRecording || isSystemRecording ? (
              <div className="recording-controls">
                <div className="recording-indicator">
                  <span className="rec-dot" />
                  <span className="rec-timer">{pad(minutes)}:{pad(seconds)}</span>
                  <span className="rec-label">Recording</span>
                </div>
                <button id="btn-stop" className="btn-stop" onClick={onStop}>
                  <Square size={16} fill="currentColor" />
                  <span>Stop</span>
                </button>
              </div>
            ) : isUploading ? (
              <button id="btn-start" className="btn-start" disabled>
                <Loader2 size={18} className="upload-spinner" />
                <span>Transcribing…</span>
              </button>
            ) : (
              <>
                {/* ── Mode Selection Dropdown ── */}
                <div className="mode-dropdown-wrapper" ref={dropdownRef}>
                  <button
                    className="mode-dropdown-trigger"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    disabled={!sessionId}
                    title={!sessionId ? 'Create a session first' : 'Select transcription mode'}
                    type="button"
                  >
                    {mode === 'realtime' ? <Mic size={14} /> : <Upload size={14} />}
                    <span>{mode === 'realtime' ? 'Real-time' : 'Upload Files'}</span>
                    <ChevronDown size={12} className={`mode-chevron${isDropdownOpen ? ' open' : ''}`} />
                  </button>

                  {isDropdownOpen && (
                    <div className="mode-dropdown-menu">
                      <button
                        className={`mode-dropdown-item${mode === 'realtime' ? ' active' : ''}`}
                        onClick={() => {
                          onChangeMode('realtime');
                          setIsDropdownOpen(false);
                        }}
                        type="button"
                      >
                        <Mic size={16} />
                        <div className="mode-item-text">
                          <span className="mode-item-label">Real-time</span>
                          <span className="mode-item-sub">Transcribe live audio inputs</span>
                        </div>
                      </button>

                      <button
                        className={`mode-dropdown-item${mode === 'upload' ? ' active' : ''}`}
                        onClick={() => {
                          onChangeMode('upload');
                          setIsDropdownOpen(false);
                        }}
                        type="button"
                      >
                        <Upload size={16} />
                        <div className="mode-item-text">
                          <span className="mode-item-label">Upload Files</span>
                          <span className="mode-item-sub">Transcribe recorded audio/video</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Main action buttons based on selected mode ── */}
                {mode === 'realtime' ? (
                  <button
                    id="btn-start"
                    className="btn-start"
                    onClick={onStart}
                    disabled={!sessionId}
                    title={!sessionId ? 'Create a session first' : 'Start transcribing'}
                  >
                    <Mic size={20} />
                    <span>Start Transcribing</span>
                  </button>
                ) : (
                  <>
                    {!hasPendingFile ? (
                      <button
                        id="btn-start"
                        className="btn-start"
                        onClick={onUploadClick}
                        disabled={!sessionId}
                        title={!sessionId ? 'Create a session first' : 'Browse files from system'}
                      >
                        <Upload size={20} />
                        <span>Browse Files</span>
                      </button>
                    ) : (
                      <button
                        id="btn-start"
                        className="btn-start btn-start-ready"
                        onClick={onStart}
                        disabled={!sessionId}
                        title="Start transcribing uploaded files"
                      >
                        <Mic size={20} />
                        <span>Start Transcribing</span>
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right — clear / export */}
        <div className="control-right">
          {messages.length > 0 && (
            <>
              <button className="btn-export" onClick={onClear} title="Clear transcript">
                <Trash2 size={15} />
                <span>Clear</span>
              </button>
              <button className="btn-export" onClick={exportTxt} title="Export as .txt">
                <Download size={15} />
                <span>Export</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
