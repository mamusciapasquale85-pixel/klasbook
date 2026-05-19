# Klasbook — Fichier Projet Claude
> Dossier : `/Users/pasquale/claude/projets/klasbook/`
> Dernière mise à jour : mai 2026

---

## IDENTITÉ DU PROJET

**Nom :** Klasbook
**Type :** SaaS pédagogique (B2B/B2C — écoles et profs FWB)
**Stack :** Next.js 16.1.6 + TypeScript strict + React 19 + Supabase (PostgreSQL) + Anthropic Claude Sonnet 4.6
**Repo local :** `/Users/pasquale/claude/projets/klasbook/`
**GitHub :** `https://github.com/mamusciapasquale85-pixel/klasbook`
**Vercel projet :** `klasbook-dev` | **URL prod :** `https://cote-platform.vercel.app/`
**Supabase project ID :** `wvgluiycajijcpfifrjv`
**Dev :** Pasquale (solo), prof de néerlandais au LAB Marie Curie, Bruxelles
**Demo :** `demo@klasbook.be` / `KlasbookDemo2025!`

---

## ÉTAT ACTUEL DES FONCTIONNALITÉS

### ✅ Fonctionnalités terminées

#### 1. Auth + Onboarding
- Authentification Supabase avec RLS
- Redirect automatique : admin → `/direction`, prof → `/prof`, parent → `/parent`
- Onboarding guidé selon le rôle

#### 2. Portails multi-rôles
- **Portail prof** : tableau de bord, navigation via `ProfShell.tsx`
- **Portail parent** : accès aux bulletins et résultats de l'élève
- **Portail direction** : vue d'ensemble école

#### 3. Génération d'exercices IA — multi-matières
- **Route :** `/src/app/api/generer-exercice/route.ts`
- **Matières supportées :** Néerlandais (NL), Anglais (EN), Mathématiques, Sciences, Histoire, Géographie, Français
- **Types d'exercices :** ~25 types selon la matière (lacunes, QCM, dialogue, conjugaison, problème, géométrie, analyse de source, croquis, expression écrite, etc.)
- **Niveaux :** 1S, 2S, 3S (et CECRL : A1, A2, B1, B2)
- **Référentiels FWB intégrés :** chaque génération injecte le référentiel officiel IFPC → conformité garantie

#### 4. Référentiels FWB officiels
- **Fichier :** `/src/lib/referentiels-fwb.ts`
- **Source :** IFPC-FWB (Pacte pour un Enseignement d'Excellence)
- **Matières couvertes :** Langues Modernes (NL/EN), Français, Mathématiques, Sciences, Histoire, Géographie
- **Exports :** `REFERENTIELS_PAR_MATIERE`, `getReferentiel(subject, niveau)`, `CONTEXTE_SYSTEME_FWB`

#### 5. Compétences FWB + PDF
- Affichage des compétences par matière/niveau alignées sur le référentiel FWB
- Export PDF des compétences

#### 6. Bulletins FWB + IA
- Génération de bulletins conformes FWB via IA
- Export PDF avec canevas école personnalisé

#### 7. Créer une évaluation avec canevas école
- **Page :** `/src/app/creer-evaluation/page.tsx`
- Formulaire canevas : nom école, adresse, nom prof → sauvegardé dans `user_profiles.template_json`
- Sélecteur matière/niveau/type/thème → appel `/api/generer-exercice` → prévisualisation live
- Téléchargement PDF via jspdf (en-tête dark + accent bleu)

#### 8. Inspecteur FWB (chatbot pédagogique)
- **Route :** `/src/app/api/inspecteur-fwb/route.ts`
- Couvre TOUTES les matières du Tronc Commun
- 7 compétences : chat libre, analyse de copie, grille d'évaluation, différenciation, planification, conformité FWB, Tandem Brio
- Détection automatique de la matière depuis les messages

#### 9. Remédiations
- **Route :** `/src/app/api/remediations/[id]/route.ts` — ⚠️ NE PAS TOUCHER (bug Next.js 15 async params)
- Pipeline : Supabase → Edge Function → n8n → Airtable

---

## ARCHITECTURE TECHNIQUE

```
/src
├── app/
│   ├── api/
│   │   ├── generer-exercice/route.ts      ← IA multi-matières + référentiels FWB
│   │   ├── inspecteur-fwb/route.ts        ← Chatbot pédagogique toutes matières
│   │   ├── remediations/[id]/route.ts     ← ⚠️ NE PAS TOUCHER
│   │   └── vocal-session/route.ts         ← (à créer — module vocal)
│   ├── creer-evaluation/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── prof/
│   │   └── ProfShell.tsx                  ← Navigation sidebar
│   └── vocal/
│       └── page.tsx                       ← (à créer — module vocal)
├── components/
│   └── vocal/                             ← (à créer — VocalPlayer, VocalRecorder, PronunciationFeedback)
└── lib/
    ├── referentiels-fwb.ts               ← Tous les référentiels IFPC officiels
    ├── azure-speech.ts                   ← (à créer — module vocal)
    └── supabase/
        └── server.ts
```

---

## BASE DE DONNÉES SUPABASE

**Projet :** `wvgluiycajijcpfifrjv` | Région : `eu-west-1` | PostgreSQL 17

### Tables principales
`students`, `class_groups`, `assessments`, `resultats`, `curriculum_nodes`, `curricula`,
`rubrics`, `rubric_criteria`, `rubric_levels`, `rubric_grades`, `agenda_items`, `schools`,
`school_memberships`, `teacher_assignments`, `student_enrollments`, `remediations`, `user_profiles`

### Colonnes clés
- `user_profiles.template_json` (jsonb) = canevas école (school_name, teacher_name, address)

### Table à créer — module vocal
```sql
CREATE TABLE vocal_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id uuid REFERENCES students(id) ON DELETE CASCADE,
  langue text NOT NULL CHECK (langue IN ('nl','en','es')),
  theme text NOT NULL,
  niveau text NOT NULL,
  score_prononciation numeric(5,2),
  score_global numeric(5,2),
  nb_echanges integer DEFAULT 0,
  duree_secondes integer,
  created_at timestamptz DEFAULT now()
);
```

---

## DESIGN SYSTEM

- **Gradient principal :** `linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)`
- **Sidebar :** `#0f172a`
- **Accent :** `#0A84FF`
- **Labels UI :** toujours en français
- **Statuts :** Proposée / En cours / Terminée

---

## MODÈLE IA

- **Anthropic :** `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` dans `.env.local`
- **max_tokens :** 4000 (exercices) / 4096 (inspecteur)
- **PDF client-side :** `jspdf v4.2.0`

---

## MODULE VOCAL FWB (en cours)

**Vision :** élève ouvre session vocale, IA parle en NL/EN/ES, il répond, score prononciation + feedback grammaire.

**Stack :** Azure Speech (TTS + STT + Pronunciation Assessment)
- Voix : `nl-BE-ArnaudNeural` | `en-GB-RyanNeural` | `es-ES-AlvaroNeural`
- Vars : `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION=westeurope`

**Thèmes A1/A2 FWB :** Se présenter, La famille, La classe, La maison, La nourriture, Les vêtements, Les loisirs, La ville, La santé

**Phonèmes prioritaires francophones :** g/ch (goed), ui (huis), ij/ei (tijd), eu (neus), sch (school), assourdissement final (hond→hont)

**Roadmap :** MVP NL 1 thème A1 → 10 thèmes → EN + ES → dashboard enseignant → SaaS 15-30€/mois

---

## VARIABLES D'ENVIRONNEMENT (.env.local)

```
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://wvgluiycajijcpfifrjv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=westeurope
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_*=... (various price IDs)
RESEND_API_KEY=...
CRON_SECRET=7a8feaa7cfe535a8b9bfd28d50d65de6a69595d64996ef2d
NEXT_PUBLIC_APP_URL=...
NOTION_TOKEN=...
AIRTABLE_API_KEY=...
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=...
```

**CRON_SECRET:** Clé Bearer 48 caractères (256-bit entropy) générée via `crypto.randomBytes(24).toString('hex')`. Utilisée pour authentifier les appels cron n8n au endpoint `/api/billing/check-upcoming-renewals`. Format: `Authorization: Bearer {CRON_SECRET}`

---

## FICHIERS CLÉS SUPPLÉMENTAIRES

- `middleware.ts` — protection des routes (auth Supabase)
- `primer.md` — fichier de priorités dev (référence interne)
- `AI_SYNC_LOG.md` — journal de synchronisation IA

---

## RÈGLES DE DÉVELOPPEMENT

1. Fichiers complets uniquement (pas d'extraits partiels)
2. TypeScript strict — zéro `any`
3. Labels et statuts en français dans l'UI
4. Vérifier le schéma Supabase avant toute nouvelle table
5. MCP Supabase pour les opérations SQL
6. Commits via osascript uniquement (pas git en VM sandbox)
7. ⚠️ NE PAS TOUCHER `remediations/[id]/route.ts`
8. **Mettre à jour `klasbook.md` après chaque modification**, même mineure — journal inclus

---

## PHASE 5 — SYSTÈME DE FACTURATION & RENOUVELLEMENT

### Phase 5 Step 4 — Détection automatique des renouvellements (Completed)

#### Endpoint : `/api/billing/check-upcoming-renewals`

**Type :** GET  
**Authentication :** Bearer token (Authorization header)  
**Token :** `CRON_SECRET` from `.env.local` = `7a8feaa7cfe535a8b9bfd28d50d65de6a69595d64996ef2d`

**Comportement :**
- Détecte toutes les subscriptions Stripe expirantes dans une fenêtre 24-48 heures
- Envoie email de pré-renouvellement via Resend avec montant et date
- Marque user_profiles.renewal_warning_sent = true (idempotence)
- Prévient les emails en doublon sur invocations répétées

**Algorithme fenêtre 24-48h :**
```
now = Date.now()
windowStart = now
windowEnd = now + (48 * 60 * 60 * 1000)  // 48 heures en millisecondes

Filter: plan_expires_at BETWEEN now AND (now + 48 heures)
AND renewal_warning_sent = false
```
Rationale : 24h trop tôt = manque d'urgence client ; 48h+ = oubli. 24-48h = fenêtre action optimale.

**Sécurité Bearer Token :**
- Authorization header (vs query param) : Authorization header n'est PAS loggée en URL
- Query params exposées dans server logs + browser history (credentials leak risk)
- Standard HTTP practice pour endpoints sensibles

**Helper Functions :**
```typescript
getSupabaseAdmin()     // Supabase client avec service_role key
getUserData(userId)    // Fetch user_profiles + auth.users
planFromMetadata(sub)  // Extract plan_name de subscription.metadata
```

**Flux principal :**
1. Valide Authorization header vs CRON_SECRET
2. Récupère Stripe subscriptions via API (subscriptions.list())
3. Filtre 24-48h window + renewal_warning_sent = false
4. Pour chaque subscription :
   - Extraire charge amount (pricing.unit_amount / 100 = EUR)
   - Récupérer user data via Supabase
   - Envoyer email via Resend (sendTrialExpirationWarningEmail pattern)
   - SET renewal_warning_sent = true

**Response :**
```json
{
  "message": "Renewal warning emails processed",
  "processedCount": N,
  "successCount": N,
  "failedCount": N,
  "failedEmails": ["email@example.com"]
}
```

**SQL Migration :**
```sql
ALTER TABLE user_profiles 
ADD COLUMN renewal_warning_sent boolean DEFAULT false;
```
Purpose : Idempotence flag (duplicate email prevention)

**n8n Configuration (À faire) :**
- Trigger HTTP GET : `https://cote-platform.vercel.app/api/billing/check-upcoming-renewals`
- Header : `Authorization: Bearer 7a8feaa7cfe535a8b9bfd28d50d65de6a69595d64996ef2d`
- Fréquence : Horaire (min 2x daily) pour capturer fenêtre 24-48h
- Error handling : Vérifier HTTP 200, logger failedEmails

---

## PROCHAINES ÉTAPES

- [ ] Module vocal — MVP NL (1 thème A1)
- [ ] Page élève : interface pour passer les exercices générés
- [ ] Sauvegarde des exercices générés en base
- [ ] Historique des évaluations par classe
- [ ] Export vers Google Classroom / Teams
- [ ] Commercialisation : pricing par école / abonnement mensuel
- [ ] Landing page + onboarding nouveaux profs
- [ ] Correction automatique des copies élèves

---

## JOURNAL

### Mars 2026 — Multi-matières + Référentiels FWB
- Extension Klasbook de NL → 7 matières
- Création `referentiels-fwb.ts` avec référentiels IFPC officiels
- Page `/creer-evaluation` avec canevas école + export PDF
- Migration Supabase : `template_json` dans `user_profiles`

### Avril–Mai 2026 — Consolidation
- Fix onboarding redirect admin `/direction` + RLS
- Fix demo login via API route
- Fix compétences/bulletins relation ambiguë
- Module vocal : architecture définie, stack Azure Speech sélectionnée
- Fix affichage message d'erreur Azure (pas générique 500)
- Reorganisation : repo renommé `cote-platform` → `klasbook`, dossier local → `claude/projets/klasbook`

### 19 mai 2026 — Fix reset password
- Bug : lien email reset redirigait vers la page de connexion
- Cause : `resetPasswordForEmail` pointait vers `/reset-password` directement (flow PKCE non géré)
- Fix : `redirectTo` → `/auth/callback?next=/reset-password` dans `login/page.tsx`
- Fix : `auth/callback/route.ts` lit le param `next` et redirige explicitement si présent

### 13 mai 2026 — RLS Verification (Phase 3) + JOURNAL Update (Phase 4)
- **Phase 3 Résultats :** Vérification RLS complétée sur 16/17 tables
  - 16 tables avec `enable_rls=true` et policies actives
  - 1 table absent (teachers) — discrepancy noté, schema réel = 16 tables
  - **Pattern A (school-wide access) : 10 tables** — schools, school_memberships, users_public, competences, assessments, resultats, curriculum_nodes, curricula, agenda_items, resources
  - **Pattern B (student-owned + admin audit) : 3 tables** — discipline_notes, remarques, student_messages
  - **Pattern C (class-scoped) : 2 tables** — lesson_notes, bulletin_items
- **Architectural insight :** Students table sans `user_id` — auth via 3-table join : `students → school_memberships → auth.uid()`
- **Phase 4 :** JOURNAL actualisé avec résultats RLS | Préparation investigation système paiement (Stripe)
