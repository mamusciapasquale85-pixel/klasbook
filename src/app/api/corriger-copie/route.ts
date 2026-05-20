import { NextResponse } from "next/server";
import { CONTEXTE_SYSTEME_FWB } from "@/lib/referentiels-fwb";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAndIncrementCorrectionUsage } from "@/lib/billing";

export const runtime = "nodejs";
export const maxDuration = 60;

type CorrectionRequest = {
  exercice_contenu: string;
  reponse_eleve: string;
  subject?: string;
  niveau?: string;
  type_exercice?: string;
  theme?: string;
  prenom?: string;
};

function toNiceError(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return (error as { message: string }).message;
  }
  return String(error);
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item && typeof item === "object" && (item as { type?: string }).type === "text")
    .map((item) => (item as { text?: string }).text ?? "")
    .join("\n\n")
    .trim();
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const quota = await checkAndIncrementCorrectionUsage(supabase, user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Limite atteinte : tu as utilisé ${quota.used}/${quota.limit} corrections ce mois-ci.`,
          quota_exceeded: true,
          upgrade_url: "/pricing",
        },
        { status: 429 }
      );
    }

    const body = (await req.json()) as CorrectionRequest;

    if (!body.exercice_contenu?.trim()) {
      return NextResponse.json({ error: "Contenu de l'exercice manquant" }, { status: 400 });
    }
    if (!body.reponse_eleve?.trim()) {
      return NextResponse.json({ error: "Réponse de l'élève manquante" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 });
    }

    const prenom = body.prenom?.trim() || "l'élève";
    const niveau = body.niveau ?? "non précisé";
    const subject = body.subject ?? "non précisé";
    const theme = body.theme ?? "non précisé";
    const typeExercice = body.type_exercice ?? "exercice";

    const prompt = `Tu es un professeur expert en correction d'exercices scolaires pour le secondaire en Fédération Wallonie-Bruxelles (FWB).

Tu dois corriger la réponse de l'élève à l'exercice suivant.

---
EXERCICE ORIGINAL :
${body.exercice_contenu}

---
RÉPONSE DE L'ÉLÈVE (${prenom}) :
${body.reponse_eleve}

---
CONTEXTE : Matière = ${subject} | Niveau = ${niveau} | Thème = ${theme} | Type = ${typeExercice}

---
Fournis une correction structurée selon ce format OBLIGATOIRE :

## 🎯 Score indicatif
[X/10] — [appréciation : Excellent / Très bien / Bien / Assez bien / Insuffisant / À retravailler]

## ✅ Points positifs
[Liste des éléments corrects — toujours au moins 1 point positif]

## ❌ Erreurs et corrections
[Pour chaque erreur : ce qui est écrit → ce qui est attendu + explication]
Si aucune erreur : "Aucune erreur significative !"

## ⚠️ Points à améliorer
[Conseils méthodologiques sans répéter les erreurs]

## 💬 Feedback pour l'élève
[3-5 lignes bienveillantes, adressées directement à ${prenom}]

## 📚 Pour aller plus loin
[1-2 conseils concrets pour progresser]

RÈGLES : Toujours bienveillant, corrections précises, conformité FWB niveau ${niveau}, répondre en français.

${CONTEXTE_SYSTEME_FWB}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as unknown;

    if (!response.ok) {
      const apiError = (payload as { error?: { message?: string } })?.error?.message || toNiceError(payload);
      return NextResponse.json({ error: `Erreur Anthropic: ${apiError}` }, { status: response.status });
    }

    const correction = extractText(payload);
    if (!correction) return NextResponse.json({ error: "Réponse vide" }, { status: 502 });

    return NextResponse.json({ correction });
  } catch (error: unknown) {
    return NextResponse.json({ error: toNiceError(error) }, { status: 500 });
  }
}
