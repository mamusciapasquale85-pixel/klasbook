"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  referenceText: string;
  langue?: string;
  theme?: string;
  niveau?: string;
  onResult: (result: PronunciationApiResult) => void;
  onError?: (msg: string) => void;
};

export type PronunciationApiResult = {
  pronScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  recognizedText: string;
  feedback: string;
  words: Array<{
    word: string;
    accuracyScore: number;
    errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
    phonemes: Array<{ phoneme: string; accuracyScore: number }>;
  }>;
  sessionId?: string | null;
};

type Status = "idle" | "requesting" | "recording" | "processing" | "error";

const MAX_DURATION_MS = 10_000; // 10 secondes max


// Conversion WebM/mp4 -> WAV PCM 16kHz (requis par Azure Speech REST API)
// Utilise OfflineAudioContext pour garantir un resampling exact à 16000 Hz.
// AudioContext({ sampleRate: 16000 }) est un simple "hint" ignoré par certains
// browsers (Safari, Chrome) qui décodent à 44100/48000 Hz — résultat : WAV header
// dit 16000 mais les échantillons sont à 48000 → Azure reçoit de l'audio 3× trop
// rapide, reconnaît le texte mais PronunciationAssessment retourne 0.
async function convertToWav(blob: Blob): Promise<Blob> {
  const ab = await blob.arrayBuffer();

  // 1. Décoder à la fréquence native du browser
  const decodeCtx = new AudioContext();
  const decoded = await decodeCtx.decodeAudioData(ab);
  await decodeCtx.close();

  // 2. Resampler vers exactement 16000 Hz via OfflineAudioContext
  const TARGET_RATE = 16000;
  const numFrames = Math.ceil(decoded.duration * TARGET_RATE);
  const offlineCtx = new OfflineAudioContext(1, numFrames, TARGET_RATE);
  const src = offlineCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offlineCtx.destination);
  src.start(0);
  const resampled = await offlineCtx.startRendering();

  return new Blob([encodeWav(resampled)], { type: "audio/wav" });
}

function encodeWav(buf: AudioBuffer): ArrayBuffer {
  const ch = buf.getChannelData(0);
  const len = ch.length;
  const out = new ArrayBuffer(44 + len * 2);
  const v = new DataView(out);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o+i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, "data"); v.setUint32(40, len * 2, true);
  for (let i = 0, o = 44; i < len; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, ch[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

export default function VocalRecorder({
  referenceText,
  langue = "nl",
  theme = "",
  niveau = "A1",
  onResult,
  onError,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoyage à l'unmount
  useEffect(() => {
    return () => {
      if (timerRef.current)    clearInterval(timerRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    setStatus("requesting");
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus("recording");

      chunksRef.current = [];
      // Safari ne supporte pas audio/webm → fallback sur audio/mp4 ou défaut browser
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        setStatus("processing");

        try {
          const webmBlob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
          const blob = await convertToWav(webmBlob);
          const form = new FormData();
          form.append("audio", blob, "recording.wav");
          form.append("reference_text", referenceText);
          form.append("langue", langue);
          form.append("theme", theme);
          form.append("niveau", niveau);

          const res = await fetch("/api/vocal-session", { method: "POST", body: form });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(payload.error || `Erreur serveur ${res.status}`);
          }

          const data = (await res.json()) as PronunciationApiResult;
          onResult(data);
          setStatus("idle");
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Erreur inconnue";
          onError?.(msg);
          setStatus("error");
          setTimeout(() => setStatus("idle"), 3000);
        }
      };

      mr.start(250); // chunks de 250ms

      // Timer affiché
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

      // Arrêt automatique après MAX_DURATION_MS
      stopTimerRef.current = setTimeout(() => mr.stop(), MAX_DURATION_MS);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Micro inaccessible";
      onError?.(msg);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [referenceText, langue, theme, niveau, onResult, onError]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  // ─── UI ──────────────────────────────────────────────────────────────────────

  if (status === "recording") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <button
          onClick={stopRecording}
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "12px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            minWidth: 180,
            justifyContent: "center",
            boxShadow: "0 0 0 4px rgba(239,68,68,0.2)",
            animation: "pulse-red 1s ease-in-out infinite",
          }}
        >
          <style>{`@keyframes pulse-red { 0%,100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.2); } 50% { box-shadow: 0 0 0 8px rgba(239,68,68,0.1); } }`}</style>
          <MicIcon />
          Arrêter ({seconds}s)
        </button>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>Parle maintenant…</span>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <button disabled style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "#7c3aed",
        color: "#fff", border: "none", borderRadius: 12,
        padding: "12px 20px", fontSize: 14, fontWeight: 600,
        minWidth: 180, justifyContent: "center", cursor: "wait",
      }}>
        <SpinnerIcon />
        Analyse en cours…
      </button>
    );
  }

  if (status === "error") {
    return (
      <button disabled style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "#ef4444", color: "#fff", border: "none",
        borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 600,
        minWidth: 180, justifyContent: "center",
      }}>
        ✕ Erreur — réessayer
      </button>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={status === "requesting"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "#FF3B30",
        color: "#fff",
        border: "none",
        borderRadius: 12,
        padding: "12px 20px",
        fontSize: 14,
        fontWeight: 600,
        cursor: status === "requesting" ? "wait" : "pointer",
        boxShadow: "0 2px 8px rgba(255,59,48,0.3)",
        minWidth: 180,
        justifyContent: "center",
        transition: "background 0.2s",
      }}
    >
      <MicIcon />
      {status === "requesting" ? "Accès micro…" : "Enregistrer ma voix"}
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
      <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" />
    </svg>
  );
}
