"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  text: string;
  langue?: string;
  label?: string;
};

type Status = "idle" | "loading" | "playing" | "error";

export default function VocalPlayer({ text, langue = "nl", label = "Écouter le modèle" }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null);

  const VOICE_LANG: Record<string, string> = {
    nl: "nl-BE", en: "en-GB", fr: "fr-FR",
  };

  const play = useCallback(() => {
    if (status === "loading") return;

    if (status === "playing") {
      window.speechSynthesis.cancel();
      setStatus("idle");
      return;
    }

    if (!window.speechSynthesis) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
      return;
    }

    setStatus("loading");

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = VOICE_LANG[langue] ?? "nl-BE";
    utter.rate = 0.85;

    // Cherche une voix native pour la langue
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang.startsWith(utter.lang)) ?? voices.find(v => v.lang.startsWith(langue));
    if (match) utter.voice = match;

    utter.onstart = () => setStatus("playing");
    utter.onend = () => setStatus("idle");
    utter.onerror = () => { setStatus("error"); setTimeout(() => setStatus("idle"), 2000); };

    uttRef.current = utter;
    window.speechSynthesis.speak(utter);
    // Fallback si onstart ne se déclenche pas
    setTimeout(() => setStatus(s => s === "loading" ? "playing" : s), 300);
  }, [text, langue, status]);

  const icon = status === "loading"
    ? <SpinnerIcon />
    : status === "playing"
    ? <StopIcon />
    : <PlayIcon />;

  const bg = status === "error"
    ? "#ef4444"
    : status === "playing"
    ? "#10b981"
    : "#0A84FF";

  return (
    <button
      onClick={play}
      disabled={status === "loading"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: bg,
        color: "#fff",
        border: "none",
        borderRadius: 12,
        padding: "12px 20px",
        fontSize: 14,
        fontWeight: 600,
        cursor: status === "loading" ? "wait" : "pointer",
        transition: "background 0.2s",
        boxShadow: "0 2px 8px rgba(10,132,255,0.25)",
        minWidth: 180,
        justifyContent: "center",
      }}
    >
      {icon}
      {status === "loading" ? "Chargement…"
        : status === "playing" ? "Arrêter"
        : status === "error"   ? "Erreur — réessayer"
        : label}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" />
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
