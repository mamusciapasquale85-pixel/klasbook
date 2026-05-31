// app/api/exercice/[token]/route.ts
// GET  — retourne les données de l'exercice (sans corrigé) pour la page publique élève
// POST — reçoit les réponses, les note avec Claude, notifie le prof par email

import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Supprime les sections corrigé du contenu avant de l'envoyer à l'élève */
function retirerCorrige(contenu: string): string {
  const lines = contenu.split("\n");
  const result: string[] = [];
  let inCorrige = false;

  for (const line of lines) {
    const t = line.trim().toUpperCase();
    if (
      t.startsWith("[CORRIGÉ") ||
      t.startsWith("[CORRIGE") ||
      t.startsWith("CORRIGÉ") ||
      t.startsWith("CORRIGE") ||
      /^\[?RÉPONSES/.test(t) ||
      /^\[?ANSWERS/.test(t)
    ) {
      inCorrige = true;
    }
    // Nouvelle section d'exercice remet à false
    if (inCorrige && /^\[EXERCICE\s+\d+/.test(t)) {
      inCorrige = false;
    }
    if (!inCorrige) result.push(line);
  }
  return result.join("\n").trim();
}

/** Parse les sections d'exercice depuis le contenu */
function parserSections(contenu: string): { titre: string; contenu: string }[] {
  const lines = contenu.split("\n");
  const sections: { titre: string; contenu: string }[] = [];
  let currentTitle = "Introduction";
  let currentLines: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    const u = t.toUpperCase();
    const isSection =
      // Avec crochets (format attendu)
      /^\[EXERCICE\s+\d+/.test(u) ||
      /^\[INTRO/.test(u) ||
      /^\[TEXTE/.test(u) ||
      /^\[MODÈLE/.test(u) ||
      /^\[MODELE/.test(u) ||
      // Sans crochets (Claude ne respecte pas toujours le format)
      /^EXERCICE\s+\d+/.test(u) ||
      /^INTRO\s+(TH[EÉ]ORIQUE|G[EÉ]N[EÉ]RAL)/.test(u) ||
      /^TEXTE\s+(N[EÉ]ERLANDAIS|NL)/.test(u) ||
      /^INTRODUCTION$/.test(u) ||
      // Titres en majuscules standalone comme "FICHE DE REMÉDIATION..."
      (t.length > 10 && t === t.toUpperCase() && /^[A-ZÉÀÈÙÂÊÎÔÛÄËÏÖÜ\s:–\-]{10,}$/.test(t) && /^(FICHE|REMÉDIATION|RÉMÉDIA)/.test(u));

    // Ignorer les sections corrigé (déjà filtrées par retirerCorrige)
    const isCorrige = /^\[?CORRIG[EÉ]/.test(u) || /^\[?R[EÉ]PONSES?/.test(u) || /^\[?ANSWERS/.test(u);

    if (isSection && !isCorrige) {
      if (currentLines.some((l) => l.trim())) {
        sections.push({ titre: currentTitle, contenu: currentLines.join("\n").trim() });
      }
      currentTitle = t.replace(/^\[/, "").replace(/\]$/, "").trim();
      currentLines = [];
    } else if (!isCorrige) {
      currentLines.push(line);
    }
  }
  if (currentLines.some((l) => l.trim())) {
    sections.push({ titre: currentTitle, contenu: currentLines.join("\n").trim() });
  }

  // Filtre les sections vides ou trop courtes
  const filtered = sections.filter((s) => s.contenu.trim().length > 5);
  return filtered.length > 0 ? filtered : [{ titre: "Exercice", contenu }];
}

// ─── Email prof ───────────────────────────────────────────────────────────────

function buildEmailProfHtml(params: {
  eleveNom: string;
  classeNom: string;
  titre: string;
  score: number;
  feedback: string;
  soumisAt: string;
  appUrl: string;
}): string {
  const { eleveNom, classeNom, titre, score, feedback, soumisAt, appUrl } = params;
  const scoreColor = score >= 70 ? "#15803D" : score >= 50 ? "#92400E" : "#991B1B";
  const scoreBg = score >= 70 ? "rgba(34,197,94,0.08)" : score >= 50 ? "rgba(251,191,36,0.1)" : "rgba(239,68,68,0.08)";
  const scoreEmoji = score >= 70 ? "✅" : score >= 50 ? "⚠️" : "❌";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.12);">
    <div style="background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);padding:22px 28px;">
      <div style="color:#fff;font-size:20px;font-weight:900;">✦ Klasbook — Résultat élève</div>
      <div style="color:rgba(255,255,255,0.85);font-size:12px;margin-top:3px;">${soumisAt}</div>
    </div>
    <div style="padding:24px 28px;">
      <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:4px;">${titre}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:20px;">👤 ${eleveNom} · 🏫 ${classeNom}</div>

      <div style="padding:16px 20px;border-radius:14px;background:${scoreBg};border:1.5px solid ${scoreColor};text-align:center;margin-bottom:20px;">
        <div style="font-size:38px;font-weight:900;color:${scoreColor};">${scoreEmoji} ${Math.round(score)}%</div>
        <div style="font-size:13px;color:${scoreColor};font-weight:600;margin-top:4px;">
          ${score >= 70 ? "Compétence acquise" : score >= 50 ? "En cours d'acquisition" : "Remédiation nécessaire"}
        </div>
      </div>

      <div style="padding:14px 16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Feedback IA</div>
        <div style="font-size:13px;color:#334155;line-height:1.7;">${feedback.replace(/\n/g, "<br/>")}</div>
      </div>

      <a href="${appUrl}" style="display:block;text-align:center;padding:12px;border-radius:10px;background:linear-gradient(135deg,#FF3B30 0%,#0A84FF 100%);color:#fff;font-weight:800;font-size:14px;text-decoration:none;">
        Voir dans Klasbook →
      </a>
    </div>
    <div style="padding:14px 28px;text-align:center;border-top:1px solid #f1f5f9;">
      <div style="font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} Klasbook · klasbook.be</div>
    </div>
  </div>
</body>
</html>`;
}

// ─── GET — Données exercice pour la page élève ────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data, error } = await supabase
    .from("exercices_envoyes")
    .select("id, titre, contenu, eleve_nom, classe_nom, annee_scolaire, statut, deadline, email_destinataire")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });
  }

  if (data.statut === "termine") {
    return NextResponse.json({ error: "Exercice déjà soumis", statut: "termine" }, { status: 409 });
  }

  const contenuSansCorrige = retirerCorrige(data.contenu as string);
  const sections = parserSections(contenuSansCorrige);

  return NextResponse.json({
    id: data.id,
    titre: data.titre,
    eleveNom: data.eleve_nom,
    classeNom: data.classe_nom,
    deadline: data.deadline,
    sections,
  });
}

// ─── POST — Soumettre les réponses ────────────────────────────────────────────

type ReponseSoumise = { sectionTitre: string; reponse: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const body = await req.json() as { reponses: ReponseSoumise[] };
  const { reponses } = body;

  if (!reponses || reponses.length === 0) {
    return NextResponse.json({ error: "Aucune réponse reçue" }, { status: 400 });
  }

  // Récupère l'exercice complet (avec corrigé)
  const { data: ex, error } = await supabase
    .from("exercices_envoyes")
    .select("id, titre, contenu, eleve_nom, classe_nom, prof_id, statut")
    .eq("token", token)
    .single();

  if (error || !ex) {
    return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });
  }

  if (ex.statut === "termine") {
    return NextResponse.json({ error: "Exercice déjà soumis" }, { status: 409 });
  }

  // Formate les réponses de l'élève
  const reponsesTexte = reponses
    .map((r) => `[${r.sectionTitre}]\n${r.reponse}`)
    .join("\n\n");

  // ── Notation par Claude ──
  const gradingPrompt = `Tu es correcteur pour un professeur de néerlandais (FWB). Voici l'exercice complet (avec corrigé) et les réponses de l'élève.

EXERCICE COMPLET (avec corrigé) :
---
${ex.contenu}
---

RÉPONSES DE L'ÉLÈVE :
---
${reponsesTexte}
---

Évalue les réponses et retourne UNIQUEMENT un JSON valide (sans markdown, sans explication avant/après) avec cette structure exacte :
{
  "score": <nombre entre 0 et 100>,
  "mention": "<Excellent|Bien|Satisfaisant|Insuffisant>",
  "feedback_global": "<2-3 phrases en français, bienveillant et précis>",
  "points_forts": "<ce que l'élève a bien réussi>",
  "points_ameliorer": "<ce que l'élève doit retravailler>"
}`;

  let score = 0;
  let feedbackGlobal = "";
  let pointsForts = "";
  let pointsAmeliorer = "";

  try {
    const raw = await callAI("", [{ role: "user", content: gradingPrompt }], 600);

    const parsed = JSON.parse(raw) as {
      score: number;
      feedback_global: string;
      points_forts: string;
      points_ameliorer: string;
    };

    score = Math.min(100, Math.max(0, parsed.score));
    feedbackGlobal = parsed.feedback_global || "";
    pointsForts = parsed.points_forts || "";
    pointsAmeliorer = parsed.points_ameliorer || "";
  } catch (e) {
    console.error("[exercice/soumettre] Erreur notation IA :", e);
    score = 0;
    feedbackGlobal = "Impossible de noter automatiquement. Le professeur corrigera manuellement.";
  }

  const feedbackComplet = [
    feedbackGlobal,
    pointsForts ? `✅ Points forts : ${pointsForts}` : "",
    pointsAmeliorer ? `📚 À retravailler : ${pointsAmeliorer}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const soumisAt = new Date();

  // ── Sauvegarde résultats ──
  await supabase
    .from("exercices_envoyes")
    .update({
      statut: "termine",
      reponses_eleve: reponsesTexte,
      score,
      feedback_ia: feedbackComplet,
      soumis_at: soumisAt.toISOString(),
    })
    .eq("token", token);

  // ── Notification prof par email ──
  if (ex.prof_id) {
    const { data: authUser } = await supabase.auth.admin.getUserById(ex.prof_id as string);
    const profEmail = authUser?.user?.email;

    if (profEmail) {
      const dateStr = soumisAt.toLocaleDateString("fr-BE", {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      const html = buildEmailProfHtml({
        eleveNom: ex.eleve_nom as string,
        classeNom: ex.classe_nom as string,
        titre: ex.titre as string,
        score,
        feedback: feedbackComplet,
        soumisAt: dateStr,
        appUrl: `${process.env.NEXT_PUBLIC_APP_URL}/remediations`,
      });

      await resend.emails.send({
        from: "Klasbook <noreply@klasbook.be>",
        to: [profEmail],
        subject: `📊 Résultat exercice — ${ex.eleve_nom} : ${Math.round(score)}%`,
        html,
      }).catch((e: unknown) => console.error("[exercice/soumettre] Erreur email prof :", e));
    }
  }

  return NextResponse.json({
    ok: true,
    score,
    feedback: feedbackComplet,
  });
}
