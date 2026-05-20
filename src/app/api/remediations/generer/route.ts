// app/api/remediations/generer/route.ts
// Route API sécurisée – clé Anthropic côté serveur uniquement
// Génère les exercices ET sauvegarde dans Supabase (remediations.exercice_propose + corrige_genere)

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAndIncrementRemediationUsage } from "@/lib/billing";

// ─── Clients ──────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Service role pour écrire dans remediations sans RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Construction du prompt ───────────────────────────────────────────────────

type Competence = "grammaire" | "conjugaison" | "vocabulaire" | "comprehension" | "expression";

function normalizeCompetence(raw: string): Competence {
  if (!raw) return "grammaire";
  const r = raw.toLowerCase();
  if (r.includes("conjugaison")) return "conjugaison";
  if (r.includes("vocabulaire")) return "vocabulaire";
  if (r.includes("comprehension") || r.includes("compréhension") || r.includes("lecture")) return "comprehension";
  if (r.includes("expression")) return "expression";
  if (r.includes("grammaire")) return "grammaire";
  return "grammaire";
}

function buildPrompt(competence: Competence, niveau: string, theme: string, eleveNom: string): string {
  const ctx = `Élève : ${eleveNom || "élève"} | Niveau : ${niveau} | Thème : ${theme} | Matière : néerlandais (langue étrangère)`;
  const base = `Tu es professeur de NÉERLANDAIS (langue étrangère) dans le secondaire belge (FWB). ${ctx}.
RÈGLE ABSOLUE N°1 : tu génères des exercices de LANGUE NÉERLANDAISE uniquement. Jamais de conjugaison française, jamais de grammaire française.
RÈGLE ABSOLUE N°2 : toutes les phrases d'exercice, exemples, textes et mots sont EN NÉERLANDAIS (nl). Seules les consignes, explications théoriques et corrigés sont en français.
RÈGLE ABSOLUE N°3 : les verbes conjugués, les mots à trouver, les phrases à compléter sont tous issus du vocabulaire et de la grammaire NÉERLANDAISE.
Réponds en texte brut, sans markdown ni astérisques.\n\n`;

  switch (competence) {
    case "grammaire":
      return base + `Génère une FICHE DE REMÉDIATION EN GRAMMAIRE NÉERLANDAISE (pas française !) sur le thème "${theme}". 5 exercices de 8 items chacun. RÈGLES ABSOLUES POUR TOUS LES EXERCICES : (1) Ne jamais donner la réponse entre parenthèses — les parenthèses servent UNIQUEMENT à indiquer le sujet ou l'infinitif à utiliser, jamais la forme conjuguée complète ni l'ordre final. (2) Chaque exercice teste un aspect DIFFÉRENT de la règle — ne pas répéter deux fois le même type de tâche.

[INTRO THÉORIQUE]
En français : explique la règle grammaticale (max 8 lignes). Donne 5 exemples EN NÉERLANDAIS avec leur traduction française. Varie les sujets et les contextes.

[EXERCICE 1 – Placer le sujet au bon endroit]
Consigne : "Place le sujet entre parenthèses au bon endroit dans la phrase."
8 phrases EN NÉERLANDAIS où le sujet est ABSENT de la phrase mais indiqué entre parenthèses. Le verbe est déjà conjugué et à la bonne place. L'élève doit insérer le sujet à la bonne position. Format : "Morgen ga ___ naar school. (ik)" → réponse : "ik" (pas "ga ik").
Numérotées 1 à 8.

[EXERCICE 2 – QCM : choisir la bonne phrase]
Consigne : "Choisis la seule phrase correcte."
8 groupes de 3 phrases EN NÉERLANDAIS (A/B/C). Une seule phrase par groupe respecte la règle, les deux autres ont des erreurs d'ordre des mots DIFFÉRENTES entre elles. Numérotées 1 à 8.

[EXERCICE 3 – Remettre les mots dans l'ordre]
Consigne : "Remets les mots dans le bon ordre pour former une phrase correcte."
8 ensembles de mots EN NÉERLANDAIS dans le désordre à remettre en ordre. Les mots sont séparés par des barres obliques. Numérotées 1 à 8. Exemple de format : "naar / ga / ik / school / morgen"

[EXERCICE 4 – Corriger l'erreur d'ordre des mots]
Consigne : "Chaque phrase contient une erreur dans l'ordre des mots. Réécris-la correctement."
8 phrases EN NÉERLANDAIS avec une seule erreur d'ordre des mots (ne pas mélanger d'autres types d'erreurs). Numérotées 1 à 8.

[EXERCICE 5 – Production guidée]
Consigne : "Complète chaque phrase librement avec au moins 3 mots en néerlandais."
8 amorces EN NÉERLANDAIS où le début est donné (avec inversion déjà effectuée) et l'élève doit terminer la phrase de façon cohérente. Format : "Vanavond kook ik ___" Numérotées 1 à 8.

[CORRIGÉ EXERCICE 1]
10 réponses en néerlandais numérotées.

[CORRIGÉ EXERCICE 2]
10 lettres (A, B ou C) numérotées.

[CORRIGÉ EXERCICE 3]
10 phrases transformées en néerlandais numérotées.

[CORRIGÉ EXERCICE 4]
10 phrases corrigées en néerlandais numérotées.

[CORRIGÉ EXERCICE 5]
10 exemples de réponses acceptables en néerlandais numérotés.`;

    case "conjugaison":
      return base + `Génère une FICHE DE REMÉDIATION EN CONJUGAISON NÉERLANDAISE (pas française !) avec 5 exercices de 10 items chacun :

[INTRO THÉORIQUE]
En français : explique le temps verbal ou la règle (max 8 lignes). Donne le paradigme complet en néerlandais (ik, jij, hij/zij, wij, jullie, zij) avec traduction française.

[EXERCICE 1 – Conjuguer à la bonne forme]
Consigne en français. Puis 10 PHRASES EN NÉERLANDAIS avec le verbe à l'infinitif entre parenthèses à conjuguer. Numérotées 1 à 10.

[EXERCICE 2 – Corriger les erreurs de conjugaison]
Consigne en français. Puis 10 PHRASES EN NÉERLANDAIS contenant une erreur de conjugaison à corriger. Numérotées 1 à 10.

[EXERCICE 3 – Choisir la bonne forme (QCM)]
Consigne en français. Puis 10 PHRASES EN NÉERLANDAIS avec 3 formes verbales proposées (A/B/C). Numérotées 1 à 10.

[EXERCICE 4 – Remettre dans l'ordre]
Consigne en français. Puis 10 GROUPES DE MOTS EN NÉERLANDAIS dans le désordre à remettre en ordre pour former une phrase correcte. Numérotées 1 à 10.

[EXERCICE 5 – Compléter un texte]
Consigne en français. Un texte EN NÉERLANDAIS de 10 phrases avec 10 verbes manquants (infinitifs donnés entre parenthèses). Numérotées 1 à 10.

[CORRIGÉ EXERCICE 1]
10 formes conjuguées numérotées.

[CORRIGÉ EXERCICE 2]
10 phrases corrigées en néerlandais numérotées.

[CORRIGÉ EXERCICE 3]
10 lettres (A, B ou C) numérotées.

[CORRIGÉ EXERCICE 4]
10 phrases reconstituées en néerlandais numérotées.

[CORRIGÉ EXERCICE 5]
10 formes verbales correctes numérotées.`;

    case "vocabulaire":
      return base + `Génère une FICHE DE REMÉDIATION EN VOCABULAIRE NÉERLANDAIS avec 5 exercices de 10 items chacun :

[INTRO – CHAMP LEXICAL]
20 MOTS EN NÉERLANDAIS du thème "${theme}" avec traduction française et une phrase exemple EN NÉERLANDAIS pour chaque mot.

[EXERCICE 1 – Associer mot et traduction]
Consigne en français. 10 MOTS EN NÉERLANDAIS numérotés 1 à 10, à associer à leur traduction française (liste A-J mélangée).

[EXERCICE 2 – Compléter les phrases]
Consigne en français + liste de 12 mots EN NÉERLANDAIS. Puis 10 PHRASES EN NÉERLANDAIS avec un mot manquant. Numérotées 1 à 10.

[EXERCICE 3 – Trouver l'intrus]
Consigne en français. 10 SÉRIES de 4 mots EN NÉERLANDAIS : trouver le mot qui n'appartient pas au champ lexical. Numérotées 1 à 10.

[EXERCICE 4 – Traduire]
Consigne en français. 10 MOTS OU EXPRESSIONS EN FRANÇAIS à traduire en néerlandais. Numérotées 1 à 10.

[EXERCICE 5 – Phrases à construire]
Consigne en français. 10 MOTS EN NÉERLANDAIS à utiliser chacun dans une phrase courte en néerlandais. Numérotées 1 à 10.

[CORRIGÉ EXERCICE 1]
10 associations numérotées (néerlandais = français).

[CORRIGÉ EXERCICE 2]
10 mots néerlandais numérotés.

[CORRIGÉ EXERCICE 3]
10 intrus numérotés avec justification en français.

[CORRIGÉ EXERCICE 4]
10 traductions en néerlandais numérotées.

[CORRIGÉ EXERCICE 5]
10 exemples de phrases acceptables en néerlandais numérotées.`;

    case "comprehension":
      return base + `Génère une FICHE DE REMÉDIATION EN COMPRÉHENSION ÉCRITE avec 5 exercices de 10 items chacun :

[TEXTE NÉERLANDAIS]
INTÉGRALEMENT EN NÉERLANDAIS. Texte de niveau A1/A2, environ 20 lignes, sur le thème "${theme}". Vocabulaire simple et accessible. NE PAS traduire le texte.

[EXERCICE 1 – Questions de compréhension générale]
Consigne en français. 10 QUESTIONS EN FRANÇAIS sur le contenu global du texte. Numérotées 1 à 10.

[EXERCICE 2 – Vrai ou Faux]
Consigne en français. 10 AFFIRMATIONS EN FRANÇAIS sur le texte. L'élève indique Vrai ou Faux. Numérotées 1 à 10.

[EXERCICE 3 – Vocabulaire en contexte]
Consigne en français. 10 MOTS EN NÉERLANDAIS extraits du texte, à associer à leur définition ou traduction française. Numérotées 1 à 10.

[EXERCICE 4 – Compléter les phrases]
Consigne en français. 10 PHRASES EN FRANÇAIS amorcées à compléter en s'appuyant sur le texte. Numérotées 1 à 10.

[EXERCICE 5 – Questions ouvertes]
Consigne en français. 10 QUESTIONS EN FRANÇAIS nécessitant une réponse personnelle courte en français, inspirée du texte. Numérotées 1 à 10.

[CORRIGÉ EXERCICE 1]
10 réponses en français numérotées.

[CORRIGÉ EXERCICE 2]
10 réponses Vrai/Faux numérotées avec justification brève.

[CORRIGÉ EXERCICE 3]
10 associations numérotées.

[CORRIGÉ EXERCICE 4]
10 phrases complètes en français numérotées.

[CORRIGÉ EXERCICE 5]
10 exemples de réponses acceptables numérotés.`;

    case "expression":
      return base + `Génère une FICHE DE REMÉDIATION EN EXPRESSION ÉCRITE avec 5 exercices de 10 items chacun :

[INTRO ET CONSIGNE]
En français : explique comment structurer un texte court en néerlandais. Donne 15 connecteurs utiles EN NÉERLANDAIS avec leur traduction française.

[MODÈLE]
Un texte modèle EN NÉERLANDAIS de 10 lignes sur le thème "${theme}". Puis traduction française complète en dessous.

[EXERCICE 1 – Amorces de phrases]
Consigne en français. 10 AMORCES DE PHRASES EN NÉERLANDAIS à compléter librement. Numérotées 1 à 10.

[EXERCICE 2 – Remettre en ordre]
Consigne en français. 10 PHRASES EN NÉERLANDAIS dont les mots sont dans le désordre à remettre dans le bon ordre. Numérotées 1 à 10.

[EXERCICE 3 – Relier les idées]
Consigne en français. 10 PAIRES DE PHRASES COURTES EN NÉERLANDAIS à relier avec le connecteur approprié (liste de connecteurs fournie). Numérotées 1 à 10.

[EXERCICE 4 – Corriger et améliorer]
Consigne en français. 10 PHRASES EN NÉERLANDAIS mal formulées à corriger et reformuler. Numérotées 1 à 10.

[EXERCICE 5 – Mini-productions]
Consigne en français. 10 SITUATIONS courtes décrites en français : l'élève rédige 2-3 phrases EN NÉERLANDAIS pour chacune. Numérotées 1 à 10.

[CORRIGÉ EXERCICE 1]
10 exemples de complétions acceptables en néerlandais numérotés.

[CORRIGÉ EXERCICE 2]
10 phrases reconstituées en néerlandais numérotées.

[CORRIGÉ EXERCICE 3]
10 phrases reliées avec connecteur en néerlandais numérotées.

[CORRIGÉ EXERCICE 4]
10 phrases corrigées en néerlandais numérotées.

[CORRIGÉ EXERCICE 5]
10 exemples de mini-productions acceptables en néerlandais numérotés.`;

    default:
      return base + `Génère une fiche de remédiation en néerlandais avec 5 exercices de 10 items chacun, adaptée au niveau ${niveau}. Inclus une explication théorique en français, des exemples en néerlandais, 5 types d'exercices variés entièrement en néerlandais, et tous les corrigés.`;
  }
}

// ─── Handler POST ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const quota = await checkAndIncrementRemediationUsage(authClient, user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Limite atteinte : tu as utilisé ${quota.used}/${quota.limit} remediations ce mois-ci.`,
          quota_exceeded: true,
          upgrade_url: "/pricing",
        },
        { status: 429 }
      );
    }

    const { competence: rawCompetence, theme, niveau, eleveNom, eleve_nom, remediationId } = await req.json();

    if (!remediationId) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const competence = normalizeCompetence(rawCompetence ?? "");
    const prompt = buildPrompt(competence, niveau ?? "1re secondaire", theme ?? "Remédiation ciblée", eleveNom ?? eleve_nom ?? "élève");

    // ── Appel Anthropic ──
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    const texte = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    // ── Sauvegarde dans Supabase ──
    const { error: dbError } = await supabase
      .from("remediations")
      .update({
        exercice_propose: { texte_brut: texte },
        theme,
        competence,
        niveau,
        exercice_genere_at: new Date().toISOString(),
      })
      .eq("id", remediationId);

    if (dbError) {
      console.warn("[generer] Avertissement Supabase :", dbError.message);
      // On renvoie quand même le texte même si la sauvegarde échoue
    }

    return NextResponse.json({
      exercice: texte,
      titre: `Remédiation ${competence} — ${theme ?? "néerlandais"}`,
      sauvegarde: !dbError,
    });
  } catch (err) {
    console.error("[generer] Erreur :", err);
    return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
  }
}
