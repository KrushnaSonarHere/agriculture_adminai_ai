/**
 * useVoiceRecorder.js
 * ────────────────────────────────────────────
 * Native MediaRecorder + Web Audio API hook.
 * No dependencies. Returns audio blob on stop.
 *
 * Usage:
 *   const { state, duration, volume, start, stop, reset } = useVoiceRecorder();
 *   // state: 'idle' | 'requesting' | 'recording' | 'stopped' | 'error'
 *   // volume: 0–100 (live mic level for waveform animation)
 *   // blob: recorded audio Blob (available after stop)
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export default function useVoiceRecorder({
  mimeType       = 'audio/webm;codecs=opus',
  maxDurationMs  = 120_000,   // 2 min hard limit
  onBlobReady    = null,       // callback(blob, durationSec)
} = {}) {

  const [state,    setState]    = useState('idle');   // idle | requesting | recording | stopped | error
  const [duration, setDuration] = useState(0);        // seconds recorded
  const [volume,   setVolume]   = useState(0);        // 0–100 RMS level
  const [blob,     setBlob]     = useState(null);
  const [error,    setError]    = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const streamRef        = useRef(null);
  const timerRef         = useRef(null);
  const startTimeRef     = useRef(null);
  const analyserRef      = useRef(null);
  const animFrameRef     = useRef(null);
  const autoStopRef      = useRef(null);

  // ── Volume analyser loop ───────────────────────────────────
  const startVolumeLoop = useCallback((stream) => {
    const ctx      = new (window.AudioContext || window.webkitAudioContext)();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = { ctx, analyser };

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
      setVolume(Math.min(100, Math.round((rms / 128) * 100)));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopVolumeLoop = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (analyserRef.current?.ctx) analyserRef.current.ctx.close().catch(() => {});
    analyserRef.current = null;
    setVolume(0);
  }, []);

  // ── Start recording ────────────────────────────────────────
  const start = useCallback(async () => {
    if (state === 'recording') return;
    setError(null);
    setBlob(null);
    chunksRef.current = [];
    setState('requesting');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      setError('Microphone access denied. Please allow microphone in browser settings.');
      setState('error');
      return;
    }

    streamRef.current = stream;

    // Pick supported MIME type
    const mime = MediaRecorder.isTypeSupported(mimeType)
      ? mimeType
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const finalMime = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(chunksRef.current, { type: finalMime });
      const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
      setBlob(audioBlob);
      setDuration(dur);
      setState('stopped');
      if (typeof onBlobReady === 'function') onBlobReady(audioBlob, dur);
    };

    recorder.start(250); // collect chunks every 250ms for live feedback
    startTimeRef.current = Date.now();
    setState('recording');
    startVolumeLoop(stream);

    // Duration counter
    timerRef.current = setInterval(() => {
      setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 500);

    // Hard max duration
    autoStopRef.current = setTimeout(() => stop(), maxDurationMs);
  }, [state, mimeType, maxDurationMs, startVolumeLoop]);

  // ── Stop recording ─────────────────────────────────────────
  const stop = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(autoStopRef.current);
    stopVolumeLoop();

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [stopVolumeLoop]);

  // ── Reset to idle ──────────────────────────────────────────
  const reset = useCallback(() => {
    stop();
    setState('idle');
    setBlob(null);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, []);

  const durationLabel = `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`;

  return { state, duration, durationLabel, volume, blob, error, start, stop, reset };
}
