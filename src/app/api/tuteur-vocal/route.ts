import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

const MATIERES: Record<string, string> = {
  nl:        "néerlandais (langue étrangère pour des élèves francophones belges)",
  en:        "anglais (langue étrangère pour des élèves francophones belges)",
  maths:     "mathématiques",
  histoire:  "histoire (programme FWB)",
  geo:       "géographie",
  sciences:  "sciences (biologie, physique, chimie)",
  fr:        "français (langue maternelle, grammaire et littérature)",
  autre:     "matière scolaire générale",
};

export async function POST(request: NextRequest) {
  try {
    const { question, matiere = "autre" } = await request.json() as { question: string; matiere: string };
    if (!question?.trim()) return NextResponse.json({ error: "Question requise" }, { status: 400 });

    const matiereLabel = MATIERES[matiere] ?? MATIERES.autre;

    const systemPrompt = `Tu es un tuteur pédagogique expert en ${matiereLabel}, travaillant avec des élèves du secondaire en Fédération Wallonie-Bruxelles (FWB).
Réponds à la question de l'élève de façon claire, pédagogique et bienveillante.
Règles :
- Réponse en FRANÇAIS uniquement (sauf si la question porte sur une langue étrangère et nécessite des exemples dans cette langue)
- Longueur : 3 à 6 phrases maximum, adaptées à la lecture à voix haute
- Pas de listes à puces, pas de markdown — texte continu naturel pour être lu à voix haute
- Commence directement par l'explication, sans formule de politesse
- Termine par une courte encouragement ou question de vérification si pertinent`;

    const explication = await callAI(systemPrompt, [{ role: "user", content: question.trim() }], 400);

    return NextResponse.json({ explication });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
