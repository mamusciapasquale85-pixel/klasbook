import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReferentiel, CONTEXTE_SYSTEME_FWB } from "@/lib/referentiels-fwb";
import { checkAndIncrementExerciceUsage } from "@/lib/billing";
import { callAI } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

type Subject =
  | "nl" | "en" | "langues_modernes"
  | "mathematiques" | "sciences"
  | "histoire" | "geographie"
  | "francais";

type Niveau = "A1" | "A2" | "B1" | "B2" | "1S" | "2S" | "3S" | "4S" | "5S" | "6S";

type ExerciceRequest = {
  type_exercice?: string;
  niveau?: string;
  theme?: string;
  langue?: string;
  subject?: string;
  attendu?: string;
  contexte_remediation?: string;
  student_id?: string;
  classe?: string;
};

// ─── Labels d'exercices par matière ──────────────────────────────────────────

const EXERCISE_LABELS: Record<string, string> = {
  // Langues modernes (existants)
  lacunes: "Texte à trous",
  qcm: "QCM",
  mots_meles: "Mots mêlés",
  associer: "Association",
  dialogue: "Dialogue à compléter",
  vocabulaire_images: "Vocabulaire",
  traduction: "Traduction",
  conjugaison: "Conjugaison",
  remise_ordre: "Remise en ordre",
  lecture: "Compréhension écrite",
  flashcards: "Flashcards",
  kahoot_csv: "Questions Kahoot",
  // Mathématiques
  calcul: "Exercices de calcul",
  probleme: "Résolution de problèmes",
  geometrie: "Géométrie",
  algebre: "Algèbre / Équations",
  statistiques: "Statistiques",
  // Sciences
  observation: "Observation / Expérience",
  schemas_sc: "Schémas légendés",
  qcm_sc: "QCM Sciences",
  protocole: "Protocole expérimental",
  // Histoire
  analyse_source: "Analyse de source",
  chronologie: "Chronologie",
  qcm_hist: "QCM Histoire",
  synthese_hist: "Synthèse historique",
  // Géographie
  analyse_carte: "Analyse de carte",
  paysage: "Analyse de paysage / photo",
  qcm_geo: "QCM Géographie",
  croquis: "Croquis / Schéma géo",
  // Français
  expression_ecrite: "Expression écrite",
  lecture_fr: "Compréhension à la lecture",
  grammaire_fr: "Grammaire française",
  orthographe: "Orthographe / Dictée",
  analyse_texte: "Analyse de texte littéraire",
};

// ─── Normalisation ─────────────────────────────────────────────────────────

function normalizeSubject(input: string | undefined): Subject {
  const val = (input ?? "nl").trim().toLowerCase();
  if (val === "en" || val === "nl") return val;
  if (val === "langues_modernes") return "langues_modernes";
  if (val === "mathematiques" || val === "maths" || val === "math") return "mathematiques";
  if (val === "sciences" || val === "biologie" || val === "chimie" || val === "physique") return "sciences";
  if (val === "histoire") return "histoire";
  if (val === "geographie" || val === "geo") return "geographie";
  if (val === "francais" || val === "français") return "francais";
  return "nl";
}

function normalizeNiveau(input: string | undefined): Niveau {
  const val = (input ?? "1S").trim().toUpperCase();
  const valid: Niveau[] = ["A1","A2","B1","B2","1S","2S","3S","4S","5S","6S"];
  return valid.includes(val as Niveau) ? (val as Niveau) : "1S";
}

function normalizeLangue(input: string | undefined): string {
  const val = (input ?? "nl").trim().toLowerCase();
  return val === "en" ? "anglais" : "néerlandais";
}

function toNiceError(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") return error.message;
    if ("error_description" in error && typeof error.error_description === "string") return error.error_description;
  }
  try { return JSON.stringify(error); } catch { return String(error); }
}

// ─── Prompts par matière ───────────────────────────────────────────────────

function buildPromptLangues(params: {
  typeExercice: string;
  niveau: string;
  theme: string;
  langue: string;
  attendu?: string;
  contexteRemediation?: string;
}): string {
  const { typeExercice, niveau, theme, langue, attendu, contexteRemediation } = params;

  const base = `Tu es un professeur de ${langue} expert et créatif pour le secondaire en Fédération Wallonie-Bruxelles (FWB).
Tu crées des exercices pédagogiques de haute qualité, engageants, clairs et immédiatement utilisables en classe.

Thème : "${theme}" | Niveau : ${niveau} | Langue cible : ${langue}
${attendu ? `\nLacune ciblée : "${attendu}" — cet exercice doit remédier précisément à cette difficulté.` : ""}
${contexteRemediation ? `\nContexte élève : ${contexteRemediation}` : ""}

RÈGLES ABSOLUES :
- Vocabulaire adapté au niveau ${niveau} (CECRL)
- Les consignes sont TOUJOURS en français, les exercices en ${langue}
- Fournis systématiquement un CORRIGÉ complet à la fin
- Structure claire avec des sections bien séparées
- Contenu authentique, contextualisé, motivant pour un ado de 12-15 ans
- FORMAT STRICT : N'utilise PAS de Markdown (**gras**, # titres, _italique_). Écris les titres de sections en MAJUSCULES (ex: TEXTE À COMPLÉTER, CORRIGÉ). Sépare chaque section par une ligne de tirets (---). Numérote les questions (1. 2. 3.). N'utilise PAS d'emojis dans le corps de l'exercice.`;

  const prompts: Record<string, string> = {
    lacunes: `${base}

TYPE : Texte à trous

Structure OBLIGATOIRE :
1. TEXTE ORIGINAL (120-150 mots en ${langue}, narratif ou dialogué, contextualisé sur "${theme}")
2. TEXTE À COMPLÉTER (même texte avec 12-15 blancs numérotés : _1_, _2_…)
3. BANQUE DE MOTS (les mots manquants dans le désordre alphabétique)
4. CORRIGÉ (liste numérotée des réponses + 2 lignes d'explication grammaticale si pertinent)`,

    qcm: `${base}

TYPE : QCM (Questionnaire à Choix Multiples)

Structure OBLIGATOIRE :
10 questions. Pour chaque question :
- La question en ${langue} ou en français
- 4 options : A) B) C) D) — une seule bonne réponse, distracteurs plausibles

Section CORRIGÉ : réponse correcte + justification en 1 phrase par question`,

    mots_meles: `${base}

TYPE : Mots mêlés

Structure OBLIGATOIRE :
1. LISTE DE 15 MOTS à trouver (mot ${langue} | traduction française) — thème "${theme}"
2. GRILLE 15×15 (ASCII, lettres majuscules, espaces entre chaque lettre) — mots cachés horizontalement, verticalement, diagonalement
3. CORRIGÉ : pour chaque mot, direction (→ ↓ ↗ ↘) et position de départ (ligne, colonne)`,

    associer: `${base}

TYPE : Association

Structure OBLIGATOIRE :
COLONNE A (numérotée 1-15) : mots/expressions en ${langue}
COLONNE B (lettres a-o, dans le désordre) : traductions/définitions/synonymes

CORRIGÉ : 1-?, 2-?, …`,

    dialogue: `${base}

TYPE : Dialogue à compléter

Structure OBLIGATOIRE :
1. CONTEXTE (2 lignes en français — qui parle, où, pourquoi)
2. DIALOGUE INCOMPLET (16-20 répliques alternées A/B, 8 répliques numérotées remplacées par [___?___])
3. BANQUE DE RÉPLIQUES (les 8 répliques manquantes dans le désordre)
4. CORRIGÉ (dialogue complet)`,

    vocabulaire_images: `${base}

TYPE : Vocabulaire illustré

Structure OBLIGATOIRE :
1. EXERCICE 1 — Association : 15 mots en ${langue} (colonne A) | 15 traductions françaises (colonne B, désordre)
2. EXERCICE 2 — Compléter des phrases : 8 phrases en ${langue} avec un mot du vocabulaire à placer
3. CORRIGÉ des deux exercices`,

    traduction: `${base}

TYPE : Traduction

Structure OBLIGATOIRE :
PARTIE 1 — Du ${langue} vers le français (8 phrases, 8-12 mots chacune)
PARTIE 2 — Du français vers le ${langue} (8 phrases)
CORRIGÉ complet avec variantes acceptables`,

    conjugaison: `${base}

TYPE : Conjugaison et grammaire

Structure OBLIGATOIRE :
1. RAPPEL DE LA RÈGLE (encadré, 4-6 lignes max, en français)
2. EXERCICE A — Conjuguer (12 phrases avec verbe à l'infinitif entre parenthèses)
3. EXERCICE B — Choisir la bonne forme (8 phrases avec 2-3 options)
4. CORRIGÉ complet`,

    remise_ordre: `${base}

TYPE : Remise en ordre

Structure OBLIGATOIRE :
1. PHRASES DÉSORDONNÉES (12 phrases, mots séparés par / )
2. BONUS : 3 mini-textes de 3 phrases à remettre dans l'ordre logique
3. CORRIGÉ complet`,

    lecture: `${base}

TYPE : Compréhension écrite

Structure OBLIGATOIRE :
1. TEXTE (180-220 mots en ${langue}, engageant, sur "${theme}")
2. QUESTIONS DE COMPRÉHENSION GLOBALE (3 questions ouvertes)
3. QUESTIONS DE DÉTAIL (5 questions précises — vrai/faux avec justification ou QCM)
4. QUESTION D'INFÉRENCE (1 question "selon vous…")
5. VOCABULAIRE : 6 mots du texte à expliquer ou traduire
6. CORRIGÉ détaillé`,

    flashcards: `${base}

TYPE : Flashcards vocabulaire

Crée 24 flashcards. Format strict (une par ligne) :
MOT EN ${langue.toUpperCase()} | TRADUCTION FRANÇAISE | EXEMPLE DE PHRASE EN ${langue}

Organise-les en 3 catégories thématiques de 8 cartes chacune.`,

    kahoot_csv: `${base}

TYPE : Questions Kahoot

Crée 12 questions pour Kahoot. Format strict pour chaque question :

Question : [texte]
A: [réponse]
B: [réponse]
C: [réponse]
D: [réponse]
Correcte: [A/B/C/D]
Explication: [1 ligne]

---`,
  };

  return prompts[typeExercice] ?? base;
}

function buildPromptMath(params: {
  typeExercice: string;
  niveau: string;
  theme: string;
  attendu?: string;
}): string {
  const { typeExercice, niveau, theme, attendu } = params;

  const base = `Tu es un professeur de mathématiques expert pour le secondaire en Fédération Wallonie-Bruxelles (FWB).
Tu crées des exercices mathématiques rigoureux, progressifs et immédiatement utilisables en classe.

Thème : "${theme}" | Niveau : ${niveau}
${attendu ? `\nLacune ciblée : "${attendu}" — cet exercice doit remédier précisément à cette difficulté.` : ""}

RÈGLES ABSOLUES :
- Énoncés clairs et précis en français
- Progression logique de la difficulté (facile → difficile)
- Toujours un CORRIGÉ complet avec les étapes de raisonnement
- Contextes variés et motivants (sport, argent, cuisine, technologie…)
- Notation et présentation conformes aux habitudes FWB
- FORMAT STRICT : N'utilise JAMAIS de LaTeX ($, \\dfrac, \\frac, etc.). Écris les fractions sous forme a/b, les équations en texte simple (ex: 3x + 5 = 14), les puissances avec ^ (ex: x^2). N'utilise pas de Markdown (**gras**, # titres). Utilise des MAJUSCULES pour les titres de sections. N'utilise PAS d'emojis.`;

  const prompts: Record<string, string> = {
    calcul: `${base}

TYPE : Exercices de calcul

Structure OBLIGATOIRE :
SÉRIE A — Calcul mental / rapide (10 opérations courtes, sans calculatrice)
SÉRIE B — Calcul posé (8 exercices avec développement)
SÉRIE C — Calcul réfléchi (4 problèmes guidés nécessitant plusieurs opérations)

CORRIGÉ complet avec résultats intermédiaires`,

    probleme: `${base}

TYPE : Résolution de problèmes

Structure OBLIGATOIRE :
5 problèmes contextualisés. Pour chaque problème :
- Situation réelle (4-5 lignes d'énoncé)
- Données clairement identifiées
- Question principale + sous-question si nécessaire
- Espace "Ma démarche :" (lignes pointillées)

CORRIGÉ détaillé : identification des données → formule/méthode → calculs → réponse rédigée`,

    geometrie: `${base}

TYPE : Géométrie

Structure OBLIGATOIRE :
PARTIE 1 — Reconnaissance et propriétés (5 questions théoriques)
PARTIE 2 — Calcul de périmètres et aires (4 figures avec dimensions)
PARTIE 3 — Construction (1-2 exercices de construction décrits pas à pas)
PARTIE 4 — Problèmes géométriques (2 problèmes contextualisés)

CORRIGÉ avec formules rappelées`,

    algebre: `${base}

TYPE : Algèbre / Équations

Structure OBLIGATOIRE :
PARTIE 1 — Simplification d'expressions (6 exercices)
PARTIE 2 — Résolution d'équations (8 équations, progression 1er → 2e degré)
PARTIE 3 — Mise en équation (3 problèmes à mettre en équation puis résoudre)

CORRIGÉ détaillé étape par étape`,

    statistiques: `${base}

TYPE : Statistiques

Structure OBLIGATOIRE :
1. TABLEAU DE DONNÉES (données réalistes sur "${theme}")
2. EXERCICE 1 — Calcul des mesures de tendance centrale (moyenne, médiane, mode)
3. EXERCICE 2 — Calcul des mesures de dispersion (étendue, quartiles)
4. EXERCICE 3 — Représentation graphique (décrire le graphique à construire)
5. EXERCICE 4 — Interprétation (3 questions d'analyse)

CORRIGÉ complet`,
  };

  return prompts[typeExercice] ?? `${base}\n\nCrée un exercice complet de type "${typeExercice}" sur le thème "${theme}" pour le niveau ${niveau}, avec corrigé.`;
}

function buildPromptSciences(params: {
  typeExercice: string;
  niveau: string;
  theme: string;
  attendu?: string;
}): string {
  const { typeExercice, niveau, theme, attendu } = params;

  const base = `Tu es un professeur de sciences (biologie, chimie, physique) expert pour le secondaire en FWB.
Tu crées des exercices scientifiques rigoureux, ancrés dans l'observation et la démarche expérimentale.

Thème : "${theme}" | Niveau : ${niveau}
${attendu ? `\nLacune ciblée : "${attendu}"` : ""}

RÈGLES ABSOLUES :
- Vocabulaire scientifique précis et correct
- Consignes en français, claires et non ambiguës
- Démarche expérimentale mise en valeur quand pertinent
- CORRIGÉ complet et scientifiquement rigoureux
- FORMAT STRICT : N'utilise PAS de Markdown (**gras**, # titres, _italique_). Écris les titres de sections en MAJUSCULES. Sépare chaque section par une ligne vide. Numérote les questions (1. 2. 3.). N'utilise PAS d'emojis dans le corps de l'exercice.`;

  const prompts: Record<string, string> = {
    observation: `${base}

TYPE : Observation / Expérience

Structure OBLIGATOIRE :
1. CONTEXTE (situation réelle d'observation ou d'expérience, 4-6 lignes)
2. MATÉRIEL (liste du matériel utilisé)
3. RÉSULTATS OBSERVÉS (tableau ou description à compléter par l'élève — laisser des espaces)
4. QUESTIONS D'ANALYSE (5 questions progressives : observation → interprétation → conclusion)
5. HYPOTHÈSE (l'élève formule une hypothèse alternative)

CORRIGÉ scientifique complet`,

    schemas_sc: `${base}

TYPE : Schémas légendés

Structure OBLIGATOIRE :
1. SCHÉMA 1 — Description textuelle d'un schéma à légender (8-12 flèches/légendes à placer)
   [Décris le schéma en ASCII simple ou par description précise]
   Liste des légendes à placer dans le désordre
2. SCHÉMA 2 — Schéma à compléter (parties manquantes à identifier)
3. QUESTIONS sur les schémas (4 questions d'interprétation)

CORRIGÉ avec tous les schémas complétés`,

    qcm_sc: `${base}

TYPE : QCM Sciences

Structure OBLIGATOIRE :
12 questions à choix multiples sur "${theme}".
Pour chaque question :
- Question précise
- 4 propositions (A, B, C, D) — une seule correcte, distracteurs scientifiquement plausibles
- Les questions couvrent : vocabulaire, mécanismes, applications, expériences

CORRIGÉ avec justification scientifique pour chaque réponse`,

    protocole: `${base}

TYPE : Protocole expérimental

Structure OBLIGATOIRE :
1. PROBLÈME SCIENTIFIQUE (question à laquelle l'expérience répond)
2. HYPOTHÈSE (à formuler par l'élève — lignes pointillées)
3. PROTOCOLE À COMPLÉTER (étapes numérotées avec certaines lacunes)
4. TABLEAU DE RÉSULTATS (à compléter après expérience — colonnes/lignes)
5. QUESTIONS DE CONCLUSION (4 questions d'analyse des résultats)

CORRIGÉ complet`,
  };

  return prompts[typeExercice] ?? `${base}\n\nCrée un exercice complet de sciences sur "${theme}" pour le niveau ${niveau}, avec corrigé.`;
}

function buildPromptHistoire(params: {
  typeExercice: string;
  niveau: string;
  theme: string;
  attendu?: string;
}): string {
  const { typeExercice, niveau, theme, attendu } = params;

  const base = `Tu es un professeur d'histoire expert pour le secondaire en Fédération Wallonie-Bruxelles (FWB).
Tu crées des exercices historiques rigoureux, favorisant l'esprit critique et l'analyse de sources.

Thème : "${theme}" | Niveau : ${niveau}
${attendu ? `\nLacune ciblée : "${attendu}"` : ""}

RÈGLES ABSOLUES :
- Exactitude historique absolue
- Consignes en français claires
- Favorise l'analyse plutôt que la mémorisation pure
- Sources authentiques ou vraisemblables (si fictives, le préciser)
- CORRIGÉ complet avec justifications historiques
- FORMAT STRICT : N'utilise PAS de Markdown (**gras**, # titres, _italique_). Écris les titres de sections en MAJUSCULES. Sépare chaque section par une ligne vide. Numérote les questions (1. 2. 3.). N'utilise PAS d'emojis dans le corps de l'exercice.`;

  const prompts: Record<string, string> = {
    analyse_source: `${base}

TYPE : Analyse de source historique

Structure OBLIGATOIRE :
1. SOURCE (texte, image décrite, ou données chiffrées — 150-200 mots — sur "${theme}")
   Précise : nature, auteur/origine, date, contexte
2. QUESTIONS D'IDENTIFICATION (3 questions : Qui ? Quoi ? Quand ? Où ?)
3. QUESTIONS D'ANALYSE (4 questions : Pourquoi ? Comment ? Que révèle cette source ?)
4. QUESTION DE SYNTHÈSE (1 question de mise en perspective historique)
5. QUESTION DE CRITIQUE DE SOURCE (fiabilité, point de vue, limites)

CORRIGÉ avec éléments de réponse attendus`,

    chronologie: `${base}

TYPE : Chronologie

Structure OBLIGATOIRE :
PARTIE 1 — Remise en ordre : 12 événements liés à "${theme}" dans le désordre → à reclasser
PARTIE 2 — Frise chronologique : description précise d'une frise à compléter (8 dates + événements à placer)
PARTIE 3 — Durées et périodisation : 4 questions sur des calculs de durée / identification de périodes
PARTIE 4 — Causes et conséquences : relier 5 causes à 5 conséquences (flèches)

CORRIGÉ complet`,

    qcm_hist: `${base}

TYPE : QCM Histoire

Structure OBLIGATOIRE :
12 questions sur "${theme}".
- Questions variées : dates, personnages, événements, causes, conséquences, concepts
- 4 propositions par question, une seule correcte

CORRIGÉ avec explication historique en 2-3 lignes par réponse`,

    synthese_hist: `${base}

TYPE : Synthèse historique

Structure OBLIGATOIRE :
1. QUESTION DE SYNTHÈSE (question ouverte sur "${theme}" nécessitant un paragraphe organisé)
2. GUIDE DE RÉDACTION (structure conseillée : introduction → argument 1 → argument 2 → argument 3 → conclusion)
3. MOTS-CLÉS À INTÉGRER (liste de 8-10 termes historiques à utiliser)
4. GRILLE D'AUTO-ÉVALUATION (critères : exactitude, organisation, vocabulaire, argumentation)

CORRIGÉ : plan détaillé + réponse-modèle`,
  };

  return prompts[typeExercice] ?? `${base}\n\nCrée un exercice d'histoire sur "${theme}" pour le niveau ${niveau}, avec corrigé.`;
}

function buildPromptGeo(params: {
  typeExercice: string;
  niveau: string;
  theme: string;
  attendu?: string;
}): string {
  const { typeExercice, niveau, theme, attendu } = params;

  const base = `Tu es un professeur de géographie expert pour le secondaire en Fédération Wallonie-Bruxelles (FWB).
Tu crées des exercices géographiques favorisant l'analyse spatiale et la compréhension des enjeux contemporains.

Thème : "${theme}" | Niveau : ${niveau}
${attendu ? `\nLacune ciblée : "${attendu}"` : ""}

RÈGLES ABSOLUES :
- Précision géographique (noms, localisations, données récentes)
- Approche multi-échelle (locale → globale)
- Consignes en français claires
- CORRIGÉ complet et géographiquement rigoureux
- FORMAT STRICT : N'utilise PAS de Markdown (**gras**, # titres, _italique_). Écris les titres de sections en MAJUSCULES. Sépare chaque section par une ligne vide. Numérote les questions (1. 2. 3.). N'utilise PAS d'emojis dans le corps de l'exercice.`;

  const prompts: Record<string, string> = {
    analyse_carte: `${base}

TYPE : Analyse de carte

Structure OBLIGATOIRE :
1. DESCRIPTION DE LA CARTE (type de carte, titre, légende fictive mais cohérente sur "${theme}")
2. EXERCICE 1 — Localisation (6 éléments à identifier/placer selon la description)
3. EXERCICE 2 — Lecture de carte (5 questions de lecture directe)
4. EXERCICE 3 — Analyse et interprétation (3 questions d'analyse des dynamiques spatiales)
5. EXERCICE 4 — Critique et limites (2 questions sur ce que la carte ne montre pas)

CORRIGÉ détaillé`,

    paysage: `${base}

TYPE : Analyse de paysage / photo

Structure OBLIGATOIRE :
1. DESCRIPTION DU PAYSAGE (description précise d'un paysage lié à "${theme}" — comme si on décrivait une photo réelle)
2. IDENTIFICATION DES ÉLÉMENTS (3 plans : premier plan, arrière-plan, éléments clés — à compléter)
3. QUESTIONS D'ANALYSE :
   - Quels types d'espaces sont présents ?
   - Quelles activités humaines voit-on ?
   - Quels enjeux ce paysage illustre-t-il ?
4. MISE EN RELATION (relier le paysage à une notion géographique vue en cours)

CORRIGÉ`,

    qcm_geo: `${base}

TYPE : QCM Géographie

Structure OBLIGATOIRE :
12 questions sur "${theme}".
- Questions variées : localisations, notions, statistiques, enjeux, acteurs
- 4 propositions par question, une seule correcte
- Données récentes et vérifiées

CORRIGÉ avec explication géographique en 1-2 lignes`,

    croquis: `${base}

TYPE : Croquis / Schéma géographique

Structure OBLIGATOIRE :
1. SUJET DU CROQUIS (titre + cadrage spatial sur "${theme}")
2. CONSIGNE DE RÉALISATION (ce que le croquis doit montrer)
3. ÉLÉMENTS OBLIGATOIRES À REPRÉSENTER (liste de 8-10 éléments avec figurés suggérés)
4. LÉGENDE GUIDÉE (catégories à compléter avec les bons éléments)
5. FONDS DE CARTE (description de ce qui est fourni à l'élève)

CORRIGÉ : description d'un croquis-modèle avec tous les éléments`,
  };

  return prompts[typeExercice] ?? `${base}\n\nCrée un exercice de géographie sur "${theme}" pour le niveau ${niveau}, avec corrigé.`;
}

function buildPromptFrancais(params: {
  typeExercice: string;
  niveau: string;
  theme: string;
  attendu?: string;
}): string {
  const { typeExercice, niveau, theme, attendu } = params;

  const base = `Tu es un professeur de français expert pour le secondaire en Fédération Wallonie-Bruxelles (FWB).
Tu crées des exercices de langue française rigoureux, variés et immédiatement utilisables en classe.

Thème : "${theme}" | Niveau : ${niveau}
${attendu ? `\nLacune ciblée : "${attendu}"` : ""}

RÈGLES ABSOLUES :
- Langue française standard, claire et correcte
- Exercices conformes au référentiel FWB
- Toujours un CORRIGÉ complet
- Textes motivants pour des ados de 12-18 ans
- FORMAT STRICT : N'utilise PAS de Markdown (**gras**, # titres, _italique_). Écris les titres de sections en MAJUSCULES. Sépare chaque section par une ligne vide. Numérote les questions (1. 2. 3.). N'utilise PAS d'emojis dans le corps de l'exercice.`;

  const prompts: Record<string, string> = {
    expression_ecrite: `${base}

TYPE : Expression écrite

Structure OBLIGATOIRE :
1. SUJET D'ÉCRITURE (situation de communication précise sur "${theme}")
2. CONTRAINTES (genre textuel, longueur, destinataire, registre)
3. CRITÈRES D'ÉVALUATION (grille : contenu, organisation, vocabulaire, syntaxe, orthographe)
4. AIDE À LA RÉDACTION (plan suggéré + mots-clés utiles)
5. EXEMPLES DE DÉBUTS DE PARAGRAPHE (3 formulations d'amorce)

CORRIGÉ : production-modèle complète + justification des choix`,

    lecture_fr: `${base}

TYPE : Compréhension à la lecture

Structure OBLIGATOIRE :
1. TEXTE (250-300 mots sur "${theme}" — narratif, explicatif ou argumentatif selon le niveau)
2. COMPRÉHENSION GLOBALE (3 questions sur l'ensemble du texte)
3. COMPRÉHENSION FINE (5 questions précises avec numéro de ligne)
4. VOCABULAIRE (5 mots du texte à expliquer dans le contexte)
5. ANALYSE STYLISTIQUE (2 questions sur les procédés d'écriture)
6. RÉACTION PERSONNELLE (1 question d'opinion motivée)

CORRIGÉ complet`,

    grammaire_fr: `${base}

TYPE : Grammaire française

Structure OBLIGATOIRE :
1. RAPPEL DE LA RÈGLE (encadré 4-6 lignes, en français simple)
2. EXERCICE 1 — Identification (soulignes, entoures, classe les éléments — 10 items)
3. EXERCICE 2 — Transformation (8 phrases à transformer selon la règle)
4. EXERCICE 3 — Correction d'erreurs (6 phrases avec fautes à corriger)
5. EXERCICE 4 — Production guidée (3 phrases à construire soi-même)

CORRIGÉ complet avec explications`,

    orthographe: `${base}

TYPE : Orthographe / Dictée préparée

Structure OBLIGATOIRE :
1. TEXTE DE DICTÉE (120-150 mots sur "${theme}" — orthographe variée et ciblée)
2. PRÉPARATION : liste des mots difficiles avec leur règle (15 mots)
3. EXERCICES PRÉPARATOIRES :
   - Exercice A : compléter les mots difficiles (10 lacunes)
   - Exercice B : choisir le bon accord (8 propositions)
   - Exercice C : conjuguer au temps cible (6 verbes)
4. DICTÉE FINALE (le texte complet)

CORRIGÉ orthographique avec règles rappelées pour chaque difficulté`,

    analyse_texte: `${base}

TYPE : Analyse de texte littéraire

Structure OBLIGATOIRE :
1. EXTRAIT LITTÉRAIRE (150-200 mots — extrait cohérent sur le thème ou le niveau de lecture demandé)
   Préciser : titre, auteur (réel ou fictif cohérent), date
2. CONTEXTUALISATION (2 questions sur l'auteur / l'époque / le genre)
3. ANALYSE DU FOND (4 questions sur les thèmes, le propos, les personnages)
4. ANALYSE DE LA FORME (3 questions sur le style, les procédés, le registre)
5. QUESTION DE SYNTHÈSE (rédiger un paragraphe d'analyse en 8-10 lignes)

CORRIGÉ avec éléments attendus et paragraphe-modèle`,
  };

  return prompts[typeExercice] ?? `${base}\n\nCrée un exercice de français sur "${theme}" pour le niveau ${niveau}, avec corrigé.`;
}

// ─── Dispatcher principal ──────────────────────────────────────────────────

function buildPrompt(params: {
  subject: Subject;
  typeExercice: string;
  niveau: string;
  theme: string;
  langue: string;
  attendu?: string;
  contexteRemediation?: string;
  memoire?: string;
  resultatsEleve?: string;
  contexteHebdo?: string;
}): string {
  const { subject, typeExercice, niveau, theme, langue, attendu, contexteRemediation, memoire, resultatsEleve, contexteHebdo } = params;

  // Récupération du référentiel FWB pour la matière et le niveau
  const referentiel = getReferentiel(subject, niveau);

  let basePrompt: string;

  if (subject === "nl" || subject === "en" || subject === "langues_modernes") {
    basePrompt = buildPromptLangues({ typeExercice, niveau, theme, langue, attendu, contexteRemediation });
  } else if (subject === "mathematiques") {
    basePrompt = buildPromptMath({ typeExercice, niveau, theme, attendu });
  } else if (subject === "sciences") {
    basePrompt = buildPromptSciences({ typeExercice, niveau, theme, attendu });
  } else if (subject === "histoire") {
    basePrompt = buildPromptHistoire({ typeExercice, niveau, theme, attendu });
  } else if (subject === "geographie") {
    basePrompt = buildPromptGeo({ typeExercice, niveau, theme, attendu });
  } else if (subject === "francais") {
    basePrompt = buildPromptFrancais({ typeExercice, niveau, theme, attendu });
  } else {
    // Fallback : langues modernes
    basePrompt = buildPromptLangues({ typeExercice, niveau, theme, langue, attendu, contexteRemediation });
  }

  // Injection mémoire pédagogique (éviter répétition)
  const memoireSection = memoire ? `

---
📚 MÉMOIRE PÉDAGOGIQUE — Exercices déjà générés récemment pour ce groupe/niveau :
${memoire}
⚠️ IMPORTANT : Ne répète PAS ces exercices. Varie les structures, les contextes et les exemples utilisés.` : "";

  // Injection résultats élève (remédiation ciblée)
  const eleveSection = resultatsEleve ? `

---
🎯 PROFIL DE L'ÉLÈVE — Données issues des évaluations récentes :
${resultatsEleve}
⚠️ IMPORTANT : Cet exercice doit remédier précisément aux lacunes identifiées ci-dessus.` : "";

  // Injection contexte hebdomadaire IA
  const hebdoSection = contexteHebdo ? `

---
📊 CONTEXTE PÉDAGOGIQUE DE LA SEMAINE :
${contexteHebdo}` : "";

  // Injection du référentiel officiel FWB
  if (referentiel) {
    return `${basePrompt}${memoireSection}${eleveSection}${hebdoSection}

---
⚠️ CONSIGNE IMPÉRATIVE : L'exercice que tu génères DOIT être conforme aux attendus officiels ci-dessous. Respecte scrupuleusement les savoirs, savoir-faire et compétences définis pour le niveau ${niveau} dans le référentiel FWB.

${referentiel}`;
  }

  return `${basePrompt}${memoireSection}${eleveSection}${hebdoSection}`;
}

function extractAnthropicText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item && typeof item === "object" && (item as { type?: string }).type === "text")
    .map((item) => (item as { text?: string }).text ?? "")
    .filter((text) => text.trim().length > 0)
    .join("\n\n")
    .trim();
}

// ─── Handler POST ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    // ─── Vérification quota freemium ───────────────────────────────────────
    const quota = await checkAndIncrementExerciceUsage(supabase, user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Limite atteinte : tu as utilisé ${quota.used}/${quota.limit} générations ce mois-ci.`,
          quota_exceeded: true,
          upgrade_url: "/pricing",
        },
        { status: 429 }
      );
    }

    const body = (await req.json()) as ExerciceRequest;

    const subject = normalizeSubject(body.subject ?? body.langue);
    const typeExercice = (body.type_exercice ?? "lacunes").trim() || "lacunes";
    const niveau = normalizeNiveau(body.niveau);
    const langue = normalizeLangue(body.langue);
    const theme = (body.theme ?? body.attendu ?? "Cours général").trim();
    const attendu = body.attendu?.trim() || undefined;
    const contexteRemediation = body.contexte_remediation?.trim() || undefined;

    // ─── Mémoire pédagogique : 5 derniers exercices (même matière + niveau) ──
    let memoire: string | undefined;
    try {
      const { data: derniers } = await supabase
        .from("exercices")
        .select("titre, theme, type_exercice, created_at")
        .eq("teacher_id", user.id)
        .eq("subject", subject as string)
        .eq("niveau", niveau)
        .order("created_at", { ascending: false })
        .limit(5);
      if (derniers && derniers.length > 0) {
        memoire = derniers
          .map((e: { titre: string; theme: string; type_exercice: string }) =>
            `- ${e.type_exercice} | Thème: "${e.theme}" | ${e.titre}`)
          .join("\n");
      }
    } catch { /* non-bloquant */ }

    // ─── Contexte élève : résultats des dernières évaluations ──────────────
    let resultatsEleve: string | undefined;
    if (body.student_id) {
      try {
        const { data: evals } = await supabase
          .from("evaluations")
          .select("titre, score, max_score, created_at, notes")
          .eq("student_id", body.student_id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (evals && evals.length > 0) {
          resultatsEleve = evals
            .map((e: { titre: string; score: number; max_score: number; notes?: string }) => {
              const pct = e.max_score > 0 ? Math.round((e.score / e.max_score) * 100) : "?";
              return `- ${e.titre} : ${e.score}/${e.max_score} (${pct}%)${e.notes ? ` — Notes: ${e.notes}` : ""}`;
            })
            .join("\n");
        }
      } catch { /* non-bloquant */ }
    }

    // ─── Contexte hebdomadaire IA (mis à jour chaque lundi) ────────────────
    let contexteHebdo: string | undefined;
    try {
      const { data: hebdo } = await supabase
        .from("ia_contexte_hebdo")
        .select("top_themes, types_negliges")
        .eq("subject", subject as string)
        .order("semaine", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hebdo) {
        const parts = [];
        if (hebdo.top_themes?.length > 0)
          parts.push(`Thèmes les plus travaillés en ce moment : ${hebdo.top_themes.join(", ")}`);
        if (hebdo.types_negliges?.length > 0)
          parts.push(`Types d'exercices peu utilisés récemment (à privilégier) : ${hebdo.types_negliges.join(", ")}`);
        if (parts.length > 0) contexteHebdo = parts.join("\n");
      }
    } catch { /* non-bloquant */ }

    const prompt = buildPrompt({ subject, typeExercice, niveau, theme, langue, attendu, contexteRemediation, memoire, resultatsEleve, contexteHebdo });

    const systemPrompt = `Tu es un expert en création de matériel pédagogique pour l'enseignement secondaire en Belgique francophone.
Tu produis des exercices structurés, complets et immédiatement utilisables, pour toutes les matières.
Tes productions sont TOUJOURS conformes aux référentiels officiels du Tronc Commun de la Fédération Wallonie-Bruxelles (FWB).
${CONTEXTE_SYSTEME_FWB}`;

    const exercice = await callAI(systemPrompt, [{ role: "user", content: prompt }], 4000);

    const typeLabel = EXERCISE_LABELS[typeExercice] ?? "Exercice";
    const titre = `${typeLabel} – ${theme} (${niveau})`;

    // Sauvegarde en base
    let exerciceId: string | null = null;
    try {
      const { data: saved } = await supabase
        .from("exercices")
        .insert({
          teacher_id: user.id,
          subject: subject as string,
          type_exercice: typeExercice,
          niveau,
          theme,
          titre,
          contenu: exercice,
          classe: body.classe ?? "",
        })
        .select("id")
        .single();
      exerciceId = saved?.id ?? null;
    } catch {
      // Sauvegarde optionnelle — on ne bloque pas la génération
    }

    return NextResponse.json({ exercice, titre, id: exerciceId });
  } catch (error: unknown) {
    return NextResponse.json({ error: toNiceError(error) }, { status: 500 });
  }
}
