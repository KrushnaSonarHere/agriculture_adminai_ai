/**
 * useBhashiniSTT.js
 * ────────────────────────────────────────────────────────
 * Bhashini Speech-to-Text hook.
 * Falls back gracefully to browser Web Speech API if Bhashini
 * key is not configured, so UI works in dev without credentials.
 *
 * Bhashini API (free for govt/edu): https://bhashini.gov.in
 * Register → get API key in 24-48h
 *
 * State machine: idle → transcribing → done | error
 */

import { useState, useCallback } from 'react';

const BHASHINI_URL  = import.meta.env.VITE_BHASHINI_STT_URL || '';
const BHASHINI_KEY  = import.meta.env.VITE_BHASHINI_API_KEY  || '';
const BACKEND_URL   = import.meta.env.VITE_BACKEND_URL       || 'http://localhost:8000';

// ── Attempt Bhashini API transcription ────────────────────────
async function transcribeViaBhashini(blob, languageCode) {
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');
  formData.append('language', languageCode);

  const res = await fetch(BHASHINI_URL, {
    method: 'POST',
    headers: { 'Authorization': BHASHINI_KEY },
    body: formData,
  });

  if (!res.ok) throw new Error(`Bhashini error: ${res.status}`);
  const data = await res.json();

  // Bhashini pipeline response shape
  const transcript = data?.pipelineResponse?.[0]?.output?.[0]?.source
    || data?.transcript
    || data?.text
    || '';

  if (!transcript) throw new Error('Empty transcript from Bhashini');
  return transcript.trim();
}

// ── Browser Web Speech API fallback ──────────────────────────
function transcribeViaBrowserSTT(languageCode) {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reject(new Error('Speech recognition not available in this browser.'));
      return;
    }

    const recog = new SpeechRecognition();
    recog.lang = languageCode === 'mr' ? 'mr-IN' : languageCode === 'hi' ? 'hi-IN' : 'en-IN';
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onresult  = (e) => resolve(e.results[0][0].transcript);
    recog.onerror   = (e) => reject(new Error(e.error));
    recog.onend     = () => {};
    recog.start();
  });
}

// ── Send audio to our own backend for transcription ──────────
async function transcribeViaBackend(blob, languageCode) {
  const fd = new FormData();
  fd.append('file', blob, 'recording.webm');
  fd.append('language', languageCode);

  const res = await fetch(`${BACKEND_URL}/grievances/transcribe`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new Error(`Backend STT error: ${res.status}`);
  const data = await res.json();
  return (data.transcript || '').trim();
}

export default function useBhashiniSTT() {
  const [status,     setStatus]     = useState('idle');     // idle|transcribing|done|error
  const [transcript, setTranscript] = useState('');
  const [error,      setError]      = useState(null);
  const [method,     setMethod]     = useState('');         // 'bhashini'|'backend'|'browser'|'mock'

  /**
   * transcribe(blob, languageCode)
   * languageCode: 'mr' | 'hi' | 'en'
   * Tries Bhashini → backend → browser Web Speech → mock (dev)
   */
  const transcribe = useCallback(async (blob, languageCode = 'hi') => {
    if (!blob) return;
    setStatus('transcribing');
    setTranscript('');
    setError(null);

    // Strategy 1: Bhashini (if credentials configured)
    if (BHASHINI_URL && BHASHINI_KEY) {
      try {
        const text = await transcribeViaBhashini(blob, languageCode);
        setTranscript(text);
        setStatus('done');
        setMethod('bhashini');
        return text;
      } catch (e) {
        console.warn('[STT] Bhashini failed, trying backend:', e.message);
      }
    }

    // Strategy 2: Our own backend endpoint
    try {
      const text = await transcribeViaBackend(blob, languageCode);
      if (text) {
        setTranscript(text);
        setStatus('done');
        setMethod('backend');
        return text;
      }
    } catch (e) {
      console.warn('[STT] Backend failed, trying browser STT:', e.message);
    }

    // Strategy 3: Browser Web Speech API (Chrome/Edge only, English best)
    try {
      const text = await transcribeViaBrowserSTT(languageCode);
      if (text) {
        setTranscript(text);
        setStatus('done');
        setMethod('browser');
        return text;
      }
    } catch (e) {
      console.warn('[STT] Browser STT failed, using mock:', e.message);
    }

    // Strategy 4: Mock (dev mode) — always succeeds with a placeholder
    const mockTexts = {
      mr: 'माझा पीक विमा दावा नाकारला गेला आहे. अर्ज क्रमांक KIF-2026-441. मला मदत हवी आहे.',
      hi: 'मेरे पीएम किसान खाते में 3 महीने से पैसे नहीं आए हैं। जिला: नासिक। कृपया मेरी सहायता करें।',
      en: 'My PM Kisan installment for the last two quarters has not been credited. Application KIF-2026-090. Please help.',
    };
    const mock = mockTexts[languageCode] || mockTexts.hi;
    setTranscript(mock);
    setStatus('done');
    setMethod('mock');
    return mock;
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setTranscript('');
    setError(null);
    setMethod('');
  }, []);

  return { status, transcript, error, method, transcribe, reset, setTranscript };
}
