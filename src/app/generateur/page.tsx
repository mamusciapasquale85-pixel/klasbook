"use client";
import { useRef, useState, useEffect } from "react";
import { gsap } from "gsap";

function AnimatedMessage({ children, role }: { children: React.ReactNode; role: "user" | "assistant" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { opacity: 0, y: 18, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power2.out" }
    );
  }, []);
  return (
    <div ref={ref} style={{ display: "flex", justifyContent: role === "user" ? "flex-end" : "flex-start" }}>
      {children}
    </div>
  );
}

type Message = { role: "user" | "assistant"; content: string; id: string };

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

// ─── CONFIG PAR MATIÈRE ────────────────────────────────────────────────────

type SkillId = "chat" | "exercices" | "grille" | "analyse" | "planning" | "cours";

type SkillConfig = {
  id: SkillId;
  label: string;
  emoji: string;
  color: string;
  description: string;
  placeholder: string;
  suggestions: { label: string; prompt: string }[];
};

function getSkills(matiere: string): SkillConfig[] {
  const m = matiere.toLowerCase();
  const isLang = /néerlandais|anglais|français langue|nl|en/.test(m);
  const isMath = /math/.test(m);
  const isSci = /science|bio|chimie|physique/.test(m);
  const isHist = /histoire/.test(m);
  const isGeo = /géo/.test(m);
  const isFr = /français/.test(m) && !isLang;

  const niveaux = "1re secondaire (niveau A2.2) ou 2e secondaire (niveau B1.1)";
  const niveauxGen = "1re ou 2e secondaire (Tronc Commun FWB)";

  const chatSuggestions: { label: string; prompt: string }[] = isLang ? [
    { label: "Attendus 1S", prompt: `Quels sont exactement les attendus pour ${matiere} en 1re secondaire selon le référentiel FWB ?` },
    { label: "Attendus 2S", prompt: `Quels sont les attendus pour ${matiere} en 2e secondaire selon le référentiel FWB ?` },
    { label: "5 compétences FWB", prompt: `Explique les compétences du référentiel FWB pour ${matiere} en 1re secondaire avec des exemples concrets.` },
    { label: "Tolérance aux erreurs", prompt: `Quelles erreurs sont tolérées en 1re secondaire pour ${matiere} selon le référentiel FWB ?` },
    { label: "Critères inspection", prompt: `Quels sont les points de vigilance lors d'une inspection pour ${matiere} en 1re secondaire ?` },
  ] : isMath ? [
    { label: "Attendus 1S Géométrie", prompt: "Quels sont les attendus FWB en géométrie pour la 1re secondaire ?" },
    { label: "Attendus 1S Nombres", prompt: "Quels sont les attendus FWB pour le champ Nombres/Algèbre en 1re secondaire ?" },
    { label: "Attendus 2S Statistiques", prompt: "Quels sont les attendus FWB en statistiques pour la 2e secondaire ?" },
    { label: "Progression spiralaire", prompt: "Comment organiser la progression spiralaire en maths sur les 2 premières années du Tronc Commun ?" },
    { label: "Critères inspection maths", prompt: "Quels sont les points de vigilance lors d'une inspection en mathématiques (Tronc Commun FWB) ?" },
  ] : isSci ? [
    { label: "Attendus 1S Sciences", prompt: "Quels sont les attendus FWB en sciences pour la 1re secondaire (biologie, chimie, physique) ?" },
    { label: "Démarche scientifique", prompt: "Comment intégrer la démarche scientifique conforme FWB dans mes cours de sciences ?" },
    { label: "Protocole expérimental", prompt: "Comment évaluer un protocole expérimental selon les critères FWB en sciences ?" },
    { label: "Critères inspection sciences", prompt: "Quels sont les points de vigilance lors d'une inspection en sciences au Tronc Commun ?" },
  ] : isHist ? [
    { label: "Attendus 1S Histoire", prompt: "Quels sont les attendus FWB en histoire pour la 1re secondaire ?" },
    { label: "Démarche critique", prompt: "Comment développer la démarche critique en histoire selon le référentiel FWB ?" },
    { label: "Fait religieux", prompt: "Comment aborder le fait religieux en histoire selon les exigences FWB ?" },
    { label: "Critères inspection histoire", prompt: "Quels sont les points de vigilance lors d'une inspection en histoire-géographie ?" },
  ] : isGeo ? [
    { label: "Attendus 1S Géographie", prompt: "Quels sont les attendus FWB en géographie pour la 1re secondaire ?" },
    { label: "Analyse spatiale", prompt: "Comment enseigner l'analyse spatiale conforme aux attendus FWB ?" },
    { label: "Repères spatiaux", prompt: "Quels repères spatiaux sont exigés en 1re et 2e secondaire selon le référentiel FWB ?" },
    { label: "Critères inspection géo", prompt: "Quels sont les points de vigilance lors d'une inspection en géographie ?" },
  ] : [
    { label: `Attendus 1S ${matiere}`, prompt: `Quels sont les attendus FWB pour ${matiere} en 1re secondaire ?` },
    { label: `Attendus 2S ${matiere}`, prompt: `Quels sont les attendus FWB pour ${matiere} en 2e secondaire ?` },
    { label: "Progression spiralaire", prompt: `Comment organiser une progression spiralaire en ${matiere} sur le Tronc Commun FWB ?` },
    { label: "Critères inspection", prompt: `Quels sont les points de vigilance lors d'une inspection en ${matiere} ?` },
  ];

  const exercicesSuggestions: { label: string; prompt: string }[] = isLang ? [
    { label: "Texte à trous 1S", prompt: `Crée un exercice de texte à trous adapté au niveau A2.2 en ${matiere} sur le thème de la famille et des présentations.` },
    { label: "QCM compréhension 2S", prompt: `Crée un QCM de compréhension à la lecture en ${matiere} niveau B1.1 sur le thème des loisirs (10 questions).` },
    { label: "Dialogue à compléter 1S", prompt: `Crée un dialogue à compléter en ${matiere} pour la 1re secondaire (A2.2) sur le thème des achats.` },
    { label: "Exercice grammaire 1S", prompt: `Crée un exercice de grammaire en ${matiere} pour la 1re secondaire sur les auxiliaires de mode.` },
    { label: "Production écrite 2S", prompt: `Crée une consigne de production écrite en ${matiere} niveau B1.1 sur la vie quotidienne (150-180 mots).` },
    { label: "Exercice vocabulaire 1S", prompt: `Crée un exercice de vocabulaire en ${matiere} niveau A2.2 sur le thème de l'école et des fournitures.` },
  ] : isMath ? [
    { label: "Exercice géométrie 1S", prompt: "Crée un exercice de géométrie (triangles, angles) pour la 1re secondaire conforme aux attendus FWB." },
    { label: "Exercice fractions 1S", prompt: "Crée un exercice sur les fractions pour la 1re secondaire conforme aux attendus FWB (5 questions progressives)." },
    { label: "Problème contextuel 2S", prompt: "Crée un problème contextuel en algèbre pour la 2e secondaire, conforme aux attendus FWB." },
    { label: "Exercice statistiques 2S", prompt: "Crée un exercice de statistiques descriptives pour la 2e secondaire (lecture de graphiques, moyenne, médiane)." },
  ] : isSci ? [
    { label: "Exercice observation 1S", prompt: "Crée un exercice d'observation scientifique (biologie cellulaire) pour la 1re secondaire conforme FWB." },
    { label: "Exercice chimie 2S", prompt: "Crée un exercice sur les réactions chimiques pour la 2e secondaire conforme aux attendus FWB." },
    { label: "QCM physique 2S", prompt: "Crée un QCM sur les forces et l'énergie pour la 2e secondaire conforme aux attendus FWB (8 questions)." },
  ] : [
    { label: `Exercice 1S ${matiere}`, prompt: `Crée un exercice pour la 1re secondaire en ${matiere} conforme aux attendus FWB.` },
    { label: `Exercice 2S ${matiere}`, prompt: `Crée un exercice pour la 2e secondaire en ${matiere} conforme aux attendus FWB.` },
    { label: "Exercice différencié", prompt: `Crée un exercice en ${matiere} avec 3 niveaux de différenciation (remédiation, standard, enrichissement).` },
  ];

  const grilleSuggestions: { label: string; prompt: string }[] = isLang ? [
    { label: "Grille EE 1S", prompt: `Crée une grille d'évaluation critériée complète conforme FWB pour l'expression écrite (EE) en ${matiere} — 1re secondaire (A2.2).` },
    { label: "Grille EOSI 1S", prompt: `Crée une grille pour l'expression orale sans interaction (EOSI) en ${matiere} — 1re secondaire (A2.2), conforme FWB.` },
    { label: "Grille CA 2S", prompt: `Crée une grille pour la compréhension à l'audition (CA) en ${matiere} — 2e secondaire (B1.1), conforme FWB.` },
    { label: "Grille EOEI 2S", prompt: `Crée une grille pour l'expression orale en interaction (EOEI) en ${matiere} — 2e secondaire (B1.1), conforme FWB.` },
  ] : [
    { label: `Grille évaluation 1S`, prompt: `Crée une grille d'évaluation critériée complète et conforme FWB pour ${matiere} en 1re secondaire.` },
    { label: `Grille évaluation 2S`, prompt: `Crée une grille d'évaluation critériée pour ${matiere} en 2e secondaire, conforme référentiel FWB.` },
    { label: "Grille production écrite", prompt: `Crée une grille pour évaluer une production écrite en ${matiere} avec les critères FWB exacts.` },
  ];

  const analyseSuggestions: { label: string; prompt: string }[] = [
    { label: "Analyser production 1S", prompt: `Analyse cette production d'un élève de 1re secondaire en ${matiere} selon le référentiel FWB :\n\n[Colle la production ici]` },
    { label: "Analyser production 2S", prompt: `Analyse cette production d'un élève de 2e secondaire en ${matiere} selon le référentiel FWB :\n\n[Colle la production ici]` },
    { label: "Corriger copie avec feedback", prompt: `Corrige cette copie d'élève en ${matiere} et rédige un feedback constructif conforme FWB :\n\n[Colle la copie ici]` },
  ];

  const planningSuggestions: { label: string; prompt: string }[] = [
    { label: `Plan annuel 1S ${matiere}`, prompt: `Génère une planification annuelle complète et conforme au référentiel FWB pour ${matiere} en 1re secondaire, 4 heures/semaine, 4 périodes de 9 semaines.` },
    { label: `Plan annuel 2S ${matiere}`, prompt: `Génère une planification annuelle pour ${matiere} en 2e secondaire, conforme référentiel FWB, 4 heures/semaine.` },
    { label: "Répartition des compétences", prompt: `Comment répartir les compétences de ${matiere} sur l'année en 1re secondaire pour être conforme au référentiel FWB ?` },
    { label: "Séquence didactique", prompt: `Crée une séquence didactique complète (3-4 semaines) pour ${matiere} en 1re secondaire sur un thème central du référentiel FWB.` },
  ];

  const coursSuggestions = [
    { label: "Exercices depuis mon cours", prompt: `Voici un extrait de mon cours de ${matiere} :\n\n[Colle ton cours ici]\n\nGénère 5 exercices variés adaptés à ce contenu pour la 1re secondaire, conformes aux attendus FWB.` },
    { label: "Questions de compréhension", prompt: `Voici un texte/cours de ${matiere} :\n\n[Colle le contenu ici]\n\nCrée 8 questions de compréhension progressives (TB → NI) pour la 1re secondaire.` },
    { label: "Exercice différencié depuis cours", prompt: `Voici un extrait de cours de ${matiere} :\n\n[Colle le contenu ici]\n\nCrée un exercice différencié en 3 niveaux (remédiation, standard, enrichissement) basé sur ce contenu.` },
    { label: "Résumé + exercices", prompt: `Voici un chapitre de ${matiere} :\n\n[Colle le chapitre]\n\nProduis : 1) un résumé structuré pour les élèves, 2) une fiche de révision, 3) 5 exercices d'application.` },
  ];

  return [
    { id: "chat",      label: "Questions FWB",   emoji: "💬", color: "#0A84FF", description: `Questions sur le référentiel ${matiere}`, placeholder: `Question sur le référentiel FWB, les attendus, les niveaux…`, suggestions: chatSuggestions },
    { id: "exercices", label: "Exercices",        emoji: "✏️", color: "#FF9500", description: "Générer des exercices conformes FWB",   placeholder: `Type d'exercice, thème, niveau (1S/2S)…`,              suggestions: exercicesSuggestions },
    { id: "cours",     label: "Depuis mon cours", emoji: "📄", color: "#AF52DE", description: "Exercices à partir d'un cours uploadé", placeholder: `Colle ton cours ou extrait de chapitre ici, puis décris ce que tu veux générer…`, suggestions: coursSuggestions },
    { id: "grille",    label: "Grille",           emoji: "📊", color: "#FF3B30", description: "Grilles d'évaluation critériées FWB",   placeholder: `Compétence, niveau (1S/2S), type d'évaluation…`,        suggestions: grilleSuggestions },
    { id: "analyse",   label: "Analyser copie",   emoji: "🔍", color: "#34C759", description: "Analyser une production élève",        placeholder: `Colle la production de l'élève (précise 1S/2S)…`,       suggestions: analyseSuggestions },
    { id: "planning",  label: "Planification",    emoji: "📅", color: "#00C7BE", description: "Planification annuelle conforme FWB",  placeholder: `Classe (1S/2S), nb heures/semaine, contraintes…`,       suggestions: planningSuggestions },
  ] as SkillConfig[];
}

// ─── COMPOSANT MARKDOWN ────────────────────────────────────────────────────

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ fontSize: 14, lineHeight: 1.85, color: "#1e293b" }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        if (/^### /.test(t)) return <div key={i} style={{ fontWeight: 900, fontSize: 12, color: "#0A84FF", marginTop: 16, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e2e8f0", paddingBottom: 3 }}>{t.replace(/^### /, "")}</div>;
        if (/^## /.test(t)) return <div key={i} style={{ fontWeight: 900, fontSize: 15, color: "#FF3B30", marginTop: 20, marginBottom: 6 }}>{t.replace(/^## /, "")}</div>;
        if (/^# /.test(t)) return <div key={i} style={{ fontWeight: 900, fontSize: 17, color: "#0F172A", marginTop: 22, marginBottom: 8 }}>{t.replace(/^# /, "")}</div>;
        if (/^---+$/.test(t)) return <hr key={i} style={{ border: "none", borderTop: "2px solid #f1f5f9", margin: "14px 0" }} />;
        if (/^(✅|🟢)/.test(t)) return <div key={i} style={{ padding: "4px 10px", background: "rgba(34,197,94,0.08)", borderLeft: "3px solid #22c55e", borderRadius: "0 8px 8px 0", marginBottom: 4, color: "#166534", fontWeight: 600 }}>{t}</div>;
        if (/^(❌|🔴)/.test(t)) return <div key={i} style={{ padding: "4px 10px", background: "rgba(220,38,38,0.08)", borderLeft: "3px solid #ef4444", borderRadius: "0 8px 8px 0", marginBottom: 4, color: "#991b1b", fontWeight: 600 }}>{t}</div>;
        if (/^(⚠️|🟡)/.test(t)) return <div key={i} style={{ padding: "4px 10px", background: "rgba(234,179,8,0.08)", borderLeft: "3px solid #eab308", borderRadius: "0 8px 8px 0", marginBottom: 4, color: "#854d0e", fontWeight: 600 }}>{t}</div>;
        if (/^\|/.test(t)) {
          if (/^\|[-| ]+\|$/.test(t)) return null;
          const cells = t.split("|").slice(1, -1).map(c => c.trim());
          const isHeader = lines[i + 1]?.trim().startsWith("|---");
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 1, marginBottom: 1 }}>
              {cells.map((cell, j) => (
                <div key={j} style={{ padding: "5px 8px", background: isHeader ? "#f1f5f9" : j === 0 ? "rgba(10,132,255,0.04)" : "#fff", border: "1px solid #e2e8f0", fontSize: 12, fontWeight: isHeader ? 700 : 400 }}>{cell}</div>
              ))}
            </div>
          );
        }
        if (/^[-•]\s/.test(t)) return <div key={i} style={{ padding: "2px 0 2px 16px", borderLeft: "3px solid #e2e8f0", marginBottom: 2, color: "#374151" }}>{t.slice(2)}</div>;
        if (/^\d+\.\s/.test(t)) return <div key={i} style={{ padding: "3px 0 3px 20px", marginBottom: 3, color: "#334155" }}>{t}</div>;
        const bold = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12px">$1</code>');
        return <div key={i} dangerouslySetInnerHTML={{ __html: bold }} style={{ marginBottom: 2 }} />;
      })}
    </div>
  );
}

// ─── PAGE PRINCIPALE ───────────────────────────────────────────────────────

export default function GenerateurPage() {
  const [matiere, setMatiere] = useState<string | null>(null);
  const [allCours, setAllCours] = useState<{ id: string; name: string }[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<SkillId>("chat");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Charger les cours du prof
  useEffect(() => {
    fetch("/api/profil/cours")
      .then(r => r.json())
      .then((d: { cours?: { id: string; name: string }[]; matiere?: string }) => {
        const list = d.cours ?? [];
        setAllCours(list);
        // Matière par défaut = matiere du profil, sinon 1er cours, sinon fallback
        const defaultMat = d.matiere ?? list[0]?.name ?? "votre matière";
        setMatiere(defaultMat);
      })
      .catch(() => setMatiere("votre matière"));
  }, []);

  const skills = getSkills(matiere ?? "");
  const currentSkill = skills.find(s => s.id === activeSkill) ?? skills[0];

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return;
    const userMsg: Message = { role: "user", content: content.trim(), id: Date.now().toString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);
    setError(null);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch("/api/inspecteur-fwb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          matiere: matiere ?? "",
          skill: activeSkill,
        }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
      const assistantMsg: Message = { role: "assistant", content: data.message ?? "", id: (Date.now() + 1).toString() };
      setMessages([...newMessages, assistantMsg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
  }

  if (!matiere) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94a3b8", fontSize: 14 }}>
      ⏳ Chargement…
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", maxHeight: 920 }}>

      {/* HEADER */}
      <div style={{ borderRadius: 18, padding: "14px 20px", background: GRADIENT, color: "#fff", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>✨ Assistant pédagogique IA</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>
            Référentiel FWB · <strong>{matiere}</strong> · 1re & 2e secondaire · Claude Sonnet
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setError(null); setInput(""); }} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 10, padding: "5px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
              Nouvelle conv.
            </button>
          )}
          {allCours.length > 1 ? (
            <select
              value={matiere ?? ""}
              onChange={e => { setMatiere(e.target.value); setMessages([]); setActiveSkill("chat"); }}
              style={{
                background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.45)",
                color: "#fff", borderRadius: 10, padding: "5px 10px", fontSize: 12,
                fontWeight: 700, cursor: "pointer", outline: "none",
              }}
            >
              {allCours.map(c => (
                <option key={c.id} value={c.name} style={{ background: "#1e293b", color: "#fff" }}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "5px 12px", fontSize: 12, fontWeight: 700 }}>
              {matiere}
            </div>
          )}
        </div>
      </div>

      {/* SKILLS — 3 colonnes × 2 rangées */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 10 }}>
        {skills.map(skill => (
          <button key={skill.id} onClick={() => setActiveSkill(skill.id)} style={{
            padding: "8px 4px", borderRadius: 12,
            border: activeSkill === skill.id ? `2px solid ${skill.color}` : "1.5px solid #e2e8f0",
            background: activeSkill === skill.id ? `${skill.color}18` : "#fff",
            color: activeSkill === skill.id ? skill.color : "#64748b",
            fontWeight: activeSkill === skill.id ? 800 : 600, fontSize: 11,
            cursor: "pointer", transition: "all 0.15s", textAlign: "center",
          }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{skill.emoji}</div>
            <div style={{ lineHeight: 1.2 }}>{skill.label}</div>
          </button>
        ))}
      </div>

      {/* SUGGESTIONS */}
      {messages.length === 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
            {currentSkill.emoji} {currentSkill.description.toUpperCase()}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {currentSkill.suggestions.map((s, i) => (
              <button key={i} onClick={() => setInput(s.prompt)} style={{
                padding: "7px 12px", borderRadius: 99,
                border: `1.5px solid ${currentSkill.color}40`,
                background: `${currentSkill.color}0a`,
                color: currentSkill.color,
                fontWeight: 600, fontSize: 12, cursor: "pointer",
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2 }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "28px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>{currentSkill.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#475569" }}>{currentSkill.label}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{currentSkill.description}</div>
            {activeSkill === "cours" && (
              <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 12, color: "#64748b", maxWidth: 400, margin: "12px auto 0" }}>
                💡 Colle un extrait de cours, une fiche, ou un chapitre et demande-moi de créer des exercices, un résumé, ou des questions.
              </div>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <AnimatedMessage key={msg.id} role={msg.role}>
            <div style={{
              maxWidth: "88%",
              borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "11px 15px",
              background: msg.role === "user" ? GRADIENT : "#fff",
              color: msg.role === "user" ? "#fff" : "#1e293b",
              border: msg.role === "assistant" ? "1px solid rgba(15,23,42,0.08)" : "none",
              boxShadow: "0 2px 8px rgba(15,23,42,0.07)",
            }}>
              {msg.role === "assistant"
                ? <MarkdownText text={msg.content} />
                : <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>{msg.content}</div>
              }
            </div>
          </AnimatedMessage>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", boxShadow: "0 2px 8px rgba(15,23,42,0.07)" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#94a3b8", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>
                  Génération en cours pour {matiere}…
                </span>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div style={{ borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b", padding: "10px 14px", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div style={{ marginTop: 10, background: "#fff", borderRadius: 16, border: `1.5px solid ${currentSkill.color}40`, padding: "10px 14px", boxShadow: "0 4px 12px rgba(15,23,42,0.06)" }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          placeholder={currentSkill.placeholder}
          rows={2}
          style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 14, lineHeight: 1.6, color: "#1e293b", background: "transparent", fontFamily: "system-ui, sans-serif", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Entrée pour envoyer · Maj+Entrée pour saut de ligne</span>
          <button
            onClick={() => void sendMessage(input)} disabled={!input.trim() || loading}
            style={{ padding: "7px 16px", borderRadius: 10, border: "none", background: !input.trim() || loading ? "#e2e8f0" : GRADIENT, color: !input.trim() || loading ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 13, cursor: !input.trim() || loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "⏳" : "Envoyer →"}
          </button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.3);opacity:1} }`}</style>
    </div>
  );
}
