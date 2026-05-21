import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assessPronunciation, VoiceName } from "@/lib/azure-speech";
import { getTtsBuffer } from "@/lib/azure-speech-cache";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Voix par langue ──────────────────────────────────────────────────────────

const VOICE_MAP: Record<string, VoiceName> = {
  nl: "nl-BE-ArnaudNeural",
  en: "en-GB-RyanNeural",
  es: "es-ES-AlvaroNeural",
  fr: "fr-BE-GerardNeural",
};

const LANG_MAP: Record<string, string> = {
  nl: "nl-BE",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-BE",
};

// nl-BE non supporté pour Pronunciation Assessment → on utilise nl-NL
const PA_LANG_MAP: Record<string, string> = {
  nl: "nl-NL",
  en: "en-GB",
  es: "es-ES",
};

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";

    // ─── Action TTS ──────────────────────────────────────────────────────────
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as {
        action: "tts";
        text: string;
        langue?: string;
      };

      if (body.action !== "tts") {
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
      }

      const voice = VOICE_MAP[body.langue ?? "nl"] ?? "nl-BE-ArnaudNeural";
      const mp3 = await getTtsBuffer(body.text, voice);

      return new NextResponse(new Uint8Array(mp3), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(mp3.byteLength),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // ─── Action Pronunciation Assessment (multipart) ──────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const audioFile     = form.get("audio") as File | null;
      const referenceText = form.get("reference_text") as string | null;
      const langue        = (form.get("langue") as string | null) ?? "nl";
      const theme         = (form.get("theme") as string | null) ?? "";
      const niveau        = (form.get("niveau") as string | null) ?? "A1";

      if (!audioFile || !referenceText) {
        return NextResponse.json({ error: "audio + reference_text requis" }, { status: 400 });
      }

      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      const paLangCode  = PA_LANG_MAP[langue] ?? "nl-NL";

      console.log(`[vocal] lang=${langue} pa_lang=${paLangCode} ref="${referenceText}"`);
      const result = await assessPronunciation(audioBuffer, referenceText, paLangCode);
      console.log(`[vocal] pronScore=${result.pronScore} recognized="${result.recognizedText}"`);
      const feedback = buildFeedback(result);

      // Sauvegarde en base (non-bloquant)
      let sessionId: string | null = null;
      try {
        const { data: saved } = await supabase
          .from("vocal_sessions")
          .insert({
            teacher_id:   user.id,
            langue,
            theme,
            niveau,
            phrase_cible: referenceText,
            score_global: result.pronScore,
            score_detail: {
              accuracy:     result.accuracyScore,
              fluency:      result.fluencyScore,
              completeness: result.completenessScore,
              words:        result.words,
            },
            feedback,
          })
          .select("id")
          .single();
        sessionId = saved?.id ?? null;
      } catch {
        // non-bloquant
      }

      return NextResponse.json({ ...result, feedback, sessionId });
    }

    return NextResponse.json({ error: "Content-Type non supporté" }, { status: 415 });

  } catch (error: unknown) {
    const msg =
      typeof error === "object" && error !== null && "message" in error
        ? (error as { message: string }).message
        : String(error);
    console.error("[vocal-session]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Générateur de feedback textuel ──────────────────────────────────────────

function buildFeedback(r: { pronScore: number; words: Array<{ word: string; errorType: string; accuracyScore: number }> }): string {
  const score = Math.round(r.pronScore);
  const errors = r.words.filter((w) => w.errorType !== "None" || w.accuracyScore < 60);

  if (score >= 90) {
    return "Excellent ! Ta prononciation est très proche d'un locuteur natif. 🎉";
  }
  if (score >= 75) {
    const weak = errors.map((w) => `« ${w.word} »`).join(", ");
    return `Bien ! Score global : ${score}/100. ${weak ? `Travaille encore : ${weak}.` : "Continue comme ça !"}`;
  }
  if (score >= 50) {
    const weak = errors.slice(0, 3).map((w) => `« ${w.word} »`).join(", ");
    return `En progrès (${score}/100). Les mots difficiles : ${weak || "réécoute le modèle et réessaie."}`;
  }
  return `Score : ${score}/100. Écoute bien le modèle, concentre-toi sur chaque mot, puis réessaie.`;
}
