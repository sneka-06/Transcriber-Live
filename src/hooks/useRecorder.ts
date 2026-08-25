import { useRef, useState } from "react";
import { socket } from "../services/socket";

export const useRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSystemRecording, setIsSystemRecording] = useState(false);

  // Mic refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // System audio refs
  const systemRecorderRef = useRef<MediaRecorder | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);

  // ── START (mic + system audio together) ──────────────────────────────────
  const startRecording = async () => {
    try {
      // 1. Start microphone
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      socket.emit("start-transcribing");

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) socket.emit("audio-chunk", event.data);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      console.log("Mic recording started");

      // 2. Ask for system audio (getDisplayMedia popup appears right after mic starts)
      // If user cancels or it fails, mic still keeps running
      try {
        console.log("Requesting system audio...");
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: true, // required to open the dialog; we stop video immediately
        });

        // Drop video tracks — we only want audio
        displayStream.getVideoTracks().forEach((t) => t.stop());

        const audioTracks = displayStream.getAudioTracks();

        if (audioTracks.length === 0) {
          // User shared a window/screen without audio — just warn, don't block mic
          console.warn("No system audio track captured.");
          return;
        }

        const audioOnlyStream = new MediaStream(audioTracks);
        systemStreamRef.current = audioOnlyStream;

        const systemRecorder = new MediaRecorder(audioOnlyStream);
        systemRecorderRef.current = systemRecorder;

        socket.emit("start-system-transcribing");

        systemRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) socket.emit("system-audio-chunk", event.data);
        };

        systemRecorder.start(250);
        setIsSystemRecording(true);
        console.log("System audio recording started");

        // Handle user stopping screen share from the browser's own stop button
        audioTracks[0].addEventListener("ended", () => {
          stopSystemAudio();
        });

      } catch {
        // User cancelled the system audio popup — that's fine, mic still works
        console.info("System audio skipped by user.");
      }

    } catch (error) {
      console.error("Microphone access denied:", error);
    }
  };

  // ── STOP (both mic and system audio) ────────────────────────────────────
  const stopRecording = () => {
    // Stop mic
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      socket.emit("stop-transcribing");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      streamRef.current = null;
      setIsRecording(false);
      console.log("Mic recording stopped");
    }

    // Stop system audio too
    stopSystemAudio();
  };

  const stopSystemAudio = () => {
    if (systemRecorderRef.current) {
      systemRecorderRef.current.stop();
      socket.emit("stop-system-transcribing");
      systemStreamRef.current?.getTracks().forEach((t) => t.stop());
      systemRecorderRef.current = null;
      systemStreamRef.current = null;
      setIsSystemRecording(false);
      console.log("System audio stopped");
    }
  };

  return {
    startRecording,
    stopRecording,
    isRecording,
    isSystemRecording,
  };
};