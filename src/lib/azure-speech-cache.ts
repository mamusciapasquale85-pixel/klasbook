/**
 * azure-speech-cache.ts
 *
 * Cache TTS (Text-To-Speech) pour Azure Speech.
 * Stratégie : les phrases répétées (exercices standards) sont générées
 * une seule fois et stockées dans Supabase Storage.
 *
 * Économie estimée : ~70% des appels TTS évités sur les 9 thèmes A1/A2.
 *
 * Usage dans vocal-session/route.ts :
 *   const audioUrl = await getTtsAudio("Hoe heet jij?", "nl-BE-ArnaudNeural");
 */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "tts-cache";
const CACHE_TTL_DAYS = 90; // régénérer après 90 jours (changements de voix Azure)

type AzureVoice =
  | "nl-BE-ArnaudNeural"
  | "nl-BE-DenaNeural"
  | "en-GB-RyanNeural"
  | "es-ES-AlvaroNeural"
  | "fr-BE-GerardNeural";

/**
 * Génère une clé de cache stable à partir du texte + voix.
 * Exemple : "nl-BE-ArnaudNeural_hoe-heet-jij.mp3"
 */
function cacheKey(text: string, voice: AzureVoice): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${voice}_${slug}.mp3`;
}

/**
 * Retourne l'URL publique du fichier audio TTS.
 * - Si le fichier existe dans le cache Supabase Storage → retourne l'URL directement.
 * - Sinon → appelle Azure Speech → stocke le résultat → retourne l'URL.
 */
export async function getTtsAudio(
  text: string,
  voice: AzureVoice
): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const key = cacheKey(text, voice);

  // 1. Vérifier le cache
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list("", { search: key });

  if (existing && existing.length > 0) {
    const file = existing.find((f) => f.name === key);
    if (file) {
      // Vérifier TTL
      const age = Date.now() - new Date(file.created_at).getTime();
      if (age < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
        return data.publicUrl;
      }
    }
  }

  // 2. Appel Azure Speech TTS
  const audioBuffer = await callAzureTts(text, voice);

  // 3. Upload dans Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(key, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadErr) {
    console.error("[TTS Cache] Upload failed:", uploadErr.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

/**
 * Variante retournant un Buffer audio (pour les API routes qui streament l'audio directement).
 * Même stratégie cache que getTtsAudio(), mais retourne les bytes plutôt qu'une URL publique.
 */
export async function getTtsBuffer(
  text: string,
  voice: AzureVoice
): Promise<Buffer> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const key = cacheKey(text, voice);

  // 1. Vérifier le cache
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list("", { search: key });

  if (existing && existing.length > 0) {
    const file = existing.find((f) => f.name === key);
    if (file) {
      const age = Date.now() - new Date(file.created_at).getTime();
      if (age < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
        const { data: blob } = await supabase.storage.from(BUCKET).download(key);
        if (blob) return Buffer.from(await blob.arrayBuffer());
      }
    }
  }

  // 2. Appel Azure Speech TTS
  const audioBuffer = await callAzureTts(text, voice);

  // 3. Upload en cache (non-bloquant en cas d'échec)
  supabase.storage
    .from(BUCKET)
    .upload(key, audioBuffer, { contentType: "audio/mpeg", upsert: true })
    .catch((err: Error) => console.error("[TTS Cache] Upload failed:", err.message));

  return Buffer.from(audioBuffer);
}

/**
 * Appel direct à l'API Azure Speech TTS.
 * Retourne un ArrayBuffer audio MP3.
 */
async function callAzureTts(text: string, voice: AzureVoice): Promise<ArrayBuffer> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION ?? "westeurope";

  if (!key) throw new Error("AZURE_SPEECH_KEY manquant");

  const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.slice(0, 5)}">
      <voice name="${voice}">
        <prosody rate="0.9">${text}</prosody>
      </voice>
    </speak>
  `.trim();

  const res = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      },
      body: ssml,
    }
  );

  if (!res.ok) {
    throw new Error(`Azure TTS error ${res.status}: ${await res.text()}`);
  }

  return res.arrayBuffer();
}

/**
 * Pré-chauffe le cache pour toutes les phrases d'un thème.
 * À appeler lors du build ou d'un cron Supabase Edge Function.
 *
 * Exemple :
 *   await warmupTtsCache(PHRASES_SE_PRESENTER, "nl-BE-ArnaudNeural");
 */
export async function warmupTtsCache(
  phrases: string[],
  voice: AzureVoice
): Promise<void> {
  for (const phrase of phrases) {
    try {
      await getTtsAudio(phrase, voice);
    } catch (err) {
      console.error(`[TTS Warmup] Échec pour "${phrase}":`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Phrases pré-définies thème "Se présenter" (A1 NL) — à pré-chauffer
// ---------------------------------------------------------------------------

export const PHRASES_SE_PRESENTER_NL = [
  "Hoe heet jij?",
  "Ik heet ...",
  "Hoe oud ben jij?",
  "Ik ben ... jaar oud.",
  "Waar woon jij?",
  "Ik woon in ...",
  "Wat doe jij?",
  "Ik ben leerling.",
  "Goedendag!",
  "Tot ziens!",
];
