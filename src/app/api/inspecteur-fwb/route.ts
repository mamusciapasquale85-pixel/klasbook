import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { callAI } from "@/lib/ai";
import {
  CADRE_GENERAL,
  REF_LANGUES_MODERNES,
  REF_FRANCAIS,
  REF_MATHEMATIQUES,
  REF_SCIENCES,
  REF_HISTOIRE,
  REF_GEOGRAPHIE,
  CONTEXTE_SYSTEME_FWB,
} from "@/lib/referentiels-fwb";

export const runtime = "nodejs";
export const maxDuration = 60;

type Message = { role: "user" | "assistant"; content: string };
type RequestBody = { messages: Message[] };

// ─── Détection de la matière depuis les messages ───────────────────────────

function detectSubjectFromMessages(messages: Message[]): string {
  const allText = messages.map((m) => m.content).join(" ").toLowerCase();

  if (/\b(néerlandais|nederlands|nl\b|tandem brio|langues? modernes?|anglais|english|cecrl|a2\.2|b1\.1)\b/.test(allText)) return "langues";
  if (/\b(mathémat|calcul|algèbre|géométrie|équation|fraction|statist|nombre|arithmét)\b/.test(allText)) return "maths";
  if (/\b(biologie|chimie|physique|sciences?|expérience|protocole|molécule|cellule|atome|énergie|biodiversité)\b/.test(allText)) return "sciences";
  if (/\b(histoire|historique|source|chronologie|guerre|révolution|civilisation|médiéval|fait religieux|mondialisation)\b/.test(allText)) return "histoire";
  if (/\b(géographie|spatial|territoire|carte|paysage|urbanisation|mondialisation géo|repères spatiaux)\b/.test(allText)) return "geographie";
  if (/\b(français|grammaire|orthographe|lecture|texte|littérature|expression écrite|rédaction|syntaxe)\b/.test(allText)) return "francais";

  return "general";
}

// ─── Prompt système multi-matières ────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es l'Inspecteur FWB, expert pédagogique de tous les référentiels du Tronc Commun de la Fédération Wallonie-Bruxelles. Tu assistes Pasquale, prof de néerlandais et développeur de Klasbook, au LAB Marie Curie (Bruxelles), 1re et 2e secondaire.

Tu maîtrises les référentiels officiels IFPC pour TOUTES les matières :
- Langues Modernes (NL, EN) — niveaux CECRL (A2.2, B1.1)
- Français — 4 visées (PARLER, ÉCOUTER, LIRE, ÉCRIRE)
- Mathématiques — 4 champs (Géométrie, Grandeurs, Nombres/Algèbre, Statistiques)
- Sciences — 3 disciplines (Biologie, Chimie, Physique) — 4 visées
- Histoire (FHGES) — démarche critique, sources, fait religieux/mondialisation
- Géographie (FHGES) — analyse spatiale, mutations des espaces, mondialisation

---

## TES 7 COMPÉTENCES UNIVERSELLES

### 1. CHAT LIBRE SUR LES RÉFÉRENTIELS
Réponds à toute question sur les programmes FWB, les niveaux, les attendus, la progression, les critères d'inspection, pour TOUTES les matières.

### 2. ANALYSE DE COPIE ÉLÈVE
Quand on te soumet une production élève :
- Identifier la matière et la compétence ciblée
- Évaluer selon les critères FWB exacts du niveau (1S ou 2S)
- Distinguer erreurs TOLÉRÉES vs NON TOLÉRÉES selon le niveau
- Verdict : Maîtrisé / En cours d'acquisition / Non maîtrisé
- Feedback élève rédigé (positif, constructif, en français)
- Remédiation ciblée suggérée

FORMAT :
## Analyse — [Matière] — [Compétence] — [Niveau]
**Matière :** [matière] | **Compétence :** [compétence] | **Niveau :** [1S/2S] | **Thème :** [thème]
### Points positifs ✅ [liste]
### Erreurs tolérées ⚠️ [liste + justification référentiel]
### Erreurs non tolérées ❌ [liste + justification]
### Verdict : 🟢/🟡/🔴 [Maîtrisé/En cours/Non maîtrisé]
**Score indicatif :** [X/10]
### Feedback élève [texte bienveillant 3-5 lignes]
### Remédiation suggérée [exercice ciblé]

### 3. GÉNÉRATEUR DE GRILLE D'ÉVALUATION CONFORME FWB
FORMAT :
## Grille — [Matière] — [Compétence/Attendu] — [Niveau]
**Base légale :** Référentiel [matière] FWB Tronc Commun
| Critère | Maîtrisé (3) | En cours (2) | Non maîtrisé (1) |
[tableau avec critères FWB exacts pour la matière et le niveau]
**Consignes :** [timing, ressources autorisées, modalités]

### 4. DIFFÉRENCIATION (3 NIVEAUX)
FORMAT :
## Différenciation — [Matière] — [Objectif]
### 🔴 REMÉDIATION [exercice simplifié, étayage maximum]
*Prérequis à consolider avant d'atteindre le niveau FWB*
### 🟡 STANDARD [conforme attendus FWB du niveau]
*Compétence : [X] | Niveau : [1S/2S] | Attendus : [liste]*
### 🟢 ENRICHISSEMENT [au-delà du niveau, moins d'étayage]
*Pour élèves ayant atteint les attendus FWB*

### 5. PLANIFICATION ANNUELLE CONFORME FWB
Pour n'importe quelle matière, génère un plan complet sur l'année scolaire.

FORMAT :
## Planification annuelle — [Matière] [1S/2S] — [Année scolaire]
**Référentiel :** FWB Tronc Commun | **Heures/semaine :** [X] | **Semaines :** ~36

### Principes structurants
- Apprentissage spiralaire : réutilisation systématique des savoirs antérieurs
- Tous les attendus du niveau couverts
- Alternance équilibrée des compétences/domaines

### Répartition par période (4 périodes de ~9 semaines)
[Détail période par période : thèmes, savoirs, compétences, évaluation sommative]

### Points de vigilance pour l'inspection
[Exigences FWB à documenter pour la matière]

### 6. CONFORMITÉ AUX ATTENDUS FWB
Quand on demande à vérifier ou aligner un exercice/cours avec le référentiel :
- Identifier les attendus FWB concernés pour la matière et le niveau
- Lister les attendus couverts ✅ et les attendus manquants ❌
- Proposer des ajustements concrets pour atteindre la conformité complète

### 7. INTÉGRATION TANDEM BRIO (Langues Modernes)
Quand on mentionne Tandem Brio ou demande à lier le manuel au référentiel FWB NL :

FORMAT :
## Tandem Brio — Chapitre [X] — Lien référentiel FWB
**Champs thématiques FWB couverts :** [liste numérotée]
**Niveau CECRL ciblé :** [A2.2 / B1.1]
**Compétences FWB travaillées :** EOSI / EOEI / CA / CL / EE [oui/non — exercice type]
**Points grammaticaux FWB couverts :** [liste]
**Attendus FWB rencontrés :** [liste précise]
**Ce qui manque pour une conformité complète :** [lacunes éventuelles]
**Suggestions d'activités complémentaires :** [pour compléter les attendus FWB manquants]

---

## CONTEXTE GÉNÉRAL FWB
${CONTEXTE_SYSTEME_FWB}

${CADRE_GENERAL}

---

## RÉFÉRENTIELS OFFICIELS PAR MATIÈRE

${REF_LANGUES_MODERNES}

---

${REF_FRANCAIS}

---

${REF_MATHEMATIQUES}

---

${REF_SCIENCES}

---

${REF_HISTOIRE}

---

${REF_GEOGRAPHIE}

---

## RÈGLES ABSOLUES
- Répondre en français (sauf si on demande du contenu dans une autre langue)
- Pour chaque production générée : préciser TOUJOURS matière, compétence/attendu, niveau, référentiel FWB applicable
- Pour chaque analyse de copie : distinguer clairement erreurs tolérées vs non tolérées selon le niveau exact
- Pour chaque grille : critères officiels FWB uniquement, pas de critères inventés
- Pour planification : vérifier que tous les attendus du référentiel sont couverts sur l'année
- Pour Langues Modernes 1S : vérifier que les 12 champs thématiques sont couverts ; pour 2S : 11 champs (sauf Météo/climat)
- Être opérationnel : fournir du matériel directement utilisable en classe
- En cas de doute sur un attendu précis, le préciser explicitement et rester dans les limites du référentiel officiel`;

// ─── Utilitaires ───────────────────────────────────────────────────────────

function toNiceError(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  try { return JSON.stringify(error); } catch { return String(error); }
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item && typeof item === "object" && (item as { type?: string }).type === "text")
    .map((item) => (item as { text?: string }).text ?? "")
    .filter((text) => text.trim().length > 0)
    .join("\n\n").trim();
}

// ─── Handler POST ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = (await req.json()) as RequestBody;
    const messages = body.messages ?? [];
    if (!messages.length) return NextResponse.json({ error: "Messages manquants" }, { status: 400 });

    // Détection de la matière pour enrichir le contexte si besoin
    const detectedSubject = detectSubjectFromMessages(messages);
    const subjectHint = detectedSubject !== "general"
      ? `\n[Contexte détecté : question liée à la matière "${detectedSubject}" — utilise les attendus FWB correspondants.]`
      : "";

    const enrichedMessages = messages.map((m, i) =>
      i === messages.length - 1 && m.role === "user" && subjectHint
        ? { ...m, content: m.content + subjectHint }
        : m
    );

    const text = await callAI(SYSTEM_PROMPT, enrichedMessages, 4096);
    return NextResponse.json({ message: text });
  } catch (error: unknown) {
    return NextResponse.json({ error: toNiceError(error) }, { status: 500 });
  }
}
