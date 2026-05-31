import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { student_name, class_name, period, results_summary } = body as {
      student_name: string;
      class_name: string;
      period: string;
      results_summary: string;
    };

    if (!student_name) {
      return NextResponse.json({ error: "student_name requis" }, { status: 400 });
    }

    const prompt = `Tu es un enseignant bienveillant en Fédération Wallonie-Bruxelles.
Tu dois rédiger une appréciation courte (2-3 phrases maximum) pour le bulletin scolaire de l'élève suivant :

Élève : ${student_name}
Classe : ${class_name}
Période : ${period}
Résultats par compétence : ${results_summary}

Règles :
- Ton positif mais honnête
- Mentionner 1-2 points forts et 1 point d'amélioration si les résultats le justifient
- Vocabulaire adapté aux bulletins scolaires belges francophones
- Ne pas répéter exactement les niveaux (NI/I/S/B/TB) dans le texte
- Maximum 60 mots
- Commencer directement par l'appréciation, sans formule d'introduction

Réponds uniquement avec le texte de l'appréciation, rien d'autre.`;

    const appreciation = await callAI("", [{ role: "user", content: prompt }], 200);

    return NextResponse.json({ appreciation });
  } catch (e: any) {
    console.error("generer-appreciation error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
