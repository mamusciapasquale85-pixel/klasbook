// ─── Azure Speech Services — client HTTP pur (pas de SDK) ───────────────────
// Env vars requises :
//   AZURE_SPEECH_KEY     → clé Azure Cognitive Services
//   AZURE_SPEECH_REGION  → ex. "westeurope"

const REGION = process.env.AZURE_SPEECH_REGION ?? "westeurope";
const KEY    = process.env.AZURE_SPEECH_KEY ?? "";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VoiceName =
  | "nl-BE-ArnaudNeural"
  | "nl-BE-DenaNeural"
  | "en-GB-RyanNeural"
  | "es-ES-AlvaroNeural"
  | "fr-BE-GerardNeural";

export type PronunciationWord = {
  word: string;
  accuracyScore: number;
  errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
  phonemes: { phoneme: string; accuracyScore: number }[];
};

export type PronunciationResult = {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronScore: number;
  words: PronunciationWord[];
  recognizedText: string;
};

// ─── TTS ─────────────────────────────────────────────────────────────────────

/**
 * Synthèse vocale → retourne un Buffer audio MP3.
 * Utilise l'API REST Azure Speech TTS.
 */
export async function synthesizeSpeech(
  text: string,
  voice: VoiceName = "nl-BE-ArnaudNeural"
): Promise<Buffer> {
  if (!KEY) throw new Error("AZURE_SPEECH_KEY manquant");

  const url = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const lang = voice.split("-").slice(0, 2).join("-"); // ex. "nl-BE"

  const ssml = `<speak version='1.0' xml:lang='${lang}'>
  <voice xml:lang='${lang}' name='${voice}'>
    <prosody rate="0.9">${escapeXml(text)}</prosody>
  </voice>
</speak>`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      "User-Agent": "Klasbook/1.0",
    },
    body: ssml,
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Azure TTS error ${res.status}: ${msg}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Pronunciation Assessment ─────────────────────────────────────────────────

/**
 * Évalue la prononciation d'un audio PCM/WAV par rapport au texte de référence.
 * @param audioBuffer  Buffer WAV (16kHz, 16bit, mono)
 * @param referenceText  Texte attendu
 * @param language  ex. "nl-BE", "en-GB"
 */
export async function assessPronunciation(
  audioBuffer: Buffer,
  referenceText: string,
  language: string = "nl-BE"
): Promise<PronunciationResult> {
  if (!KEY) throw new Error("AZURE_SPEECH_KEY manquant");

  const url =
    `https://${REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=${encodeURIComponent(language)}&format=detailed`;

  // Azure exige du base64 URL-safe (RFC 4648 §5) : +→- /→_ sans padding
  const assessmentConfig = Buffer.from(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      EnableMiscue: true,
      EnableProsodyAssessment: false,
    })
  ).toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      "Pronunciation-Assessment": assessmentConfig,
      Accept: "application/json",
    },
    body: new Uint8Array(audioBuffer),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Azure STT error ${res.status}: ${msg}`);
  }

  const data = (await res.json()) as AzureSTTResponse;
  return parseAssessmentResult(data);
}

// ─── Parseur résultat Azure ───────────────────────────────────────────────────

type AzureSTTResponse = {
  RecognitionStatus: string;
  DisplayText?: string;
  NBest?: Array<{
    PronunciationAssessment?: {
      AccuracyScore: number;
      FluencyScore: number;
      CompletenessScore: number;
      PronScore: number;
    };
    Words?: Array<{
      Word: string;
      PronunciationAssessment?: {
        AccuracyScore: number;
        ErrorType: string;
      };
      Phonemes?: Array<{
        Phoneme: string;
        PronunciationAssessment?: { AccuracyScore: number };
      }>;
    }>;
  }>;
};

function parseAssessmentResult(data: AzureSTTResponse): PronunciationResult {
  // Gestion explicite des statuts Azure non-Success
  if (data.RecognitionStatus !== "Success") {
    const MSG: Record<string, string> = {
      NoMatch:               "Aucune parole reconnue. Parle plus fort ou rapproche-toi du micro.",
      InitialSilenceTimeout: "Aucun son détecté. Vérifie que ton micro fonctionne et que tu as bien appuyé sur Enregistrer.",
      BabbleTimeout:         "Audio trop court ou trop bruité. Réessaie dans un endroit calme.",
      Error:                 "Erreur Azure Speech. Réessaie dans un instant.",
    };
    throw new Error(MSG[data.RecognitionStatus] ?? `Reconnaissance échouée : ${data.RecognitionStatus}`);
  }

  const best = data.NBest?.[0];
  const pa   = best?.PronunciationAssessment;

  const words: PronunciationWord[] = (best?.Words ?? []).map((w) => ({
    word:          w.Word,
    accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? 0,
    errorType:     (w.PronunciationAssessment?.ErrorType ?? "None") as PronunciationWord["errorType"],
    phonemes:      (w.Phonemes ?? []).map((p) => ({
      phoneme:       p.Phoneme,
      accuracyScore: p.PronunciationAssessment?.AccuracyScore ?? 0,
    })),
  }));

  return {
    accuracyScore:     pa?.AccuracyScore     ?? 0,
    fluencyScore:      pa?.FluencyScore      ?? 0,
    completenessScore: pa?.CompletenessScore ?? 0,
    pronScore:         pa?.PronScore         ?? 0,
    words,
    recognizedText:    data.DisplayText ?? "",
  };
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
