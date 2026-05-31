"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateFR } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import {
  type UUID, type TeacherContext, type ClassGroup, type Course, type Apprentissage,
  type Assessment, type ParsedAssessmentCsvRow, type AssessmentCsvImportSummary,
  type ParsedAssessmentResultCsvRow, type AssessmentResultCsvImportSummary,
  type AssessmentType, type ContentStatus,
  getTeacherContext, listClassGroups, listCourses, listApprentissages, listAssessments,
  parseAssessmentsCsv, parseAssessmentResultsCsv, importAssessmentsCsv, importAssessmentResultsCsv,
  createAssessment, updateAssessment, deleteAssessment,
  upsertResult, listResultsForAssessment,
} from "./evaluations";

function toNiceError(e: unknown): string {
  if (!e) return "Erreur inconnue";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toISODate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

type Tab = "toutes" | "formative" | "summative" | "archived" | "modeles";
const TAB_CONFIG: { id: Tab; label: string; emoji: string }[] = [
  { id: "toutes",    label: "Toutes",     emoji: "📋" },
  { id: "formative", label: "Formatives", emoji: "📊" },
  { id: "summative", label: "Sommatives", emoji: "🎓" },
  { id: "archived",  label: "Archivées",  emoji: "🗄" },
  { id: "modeles",   label: "Modèles",    emoji: "📚" },
];

type EvaluationTemplate = {
  id: string; titre: string; type: string; matiere: string;
  niveau: string | null; type_exercice: string | null; points_max: number | null;
  cotation_type: string; fichier_path: string | null; fichier_nom: string | null;
  grille: unknown; instructions: string | null; created_at: string;
};

const NIVEAUX = ["1S (A2.2)", "2S (B1.1)", "3S (B1.2)", "4S (B2.1)", "A1", "A2", "B1", "B2", "Autre"];

type SubjectDef = { id: string; label: string; emoji: string; color: string; types: { id: string; label: string }[]; niveaux: string[] };
const SUBJECTS: SubjectDef[] = [
  { id: "nl", label: "Néerlandais", emoji: "🇳🇱", color: "#FF9500", niveaux: ["A1", "A2", "B1", "B2"], types: [{ id: "lacunes", label: "Texte à trous" }, { id: "qcm", label: "QCM" }, { id: "conjugaison", label: "Conjugaison" }, { id: "dialogue", label: "Dialogue à compléter" }, { id: "traduction", label: "Traduction" }, { id: "vocabulaire_images", label: "Vocabulaire" }, { id: "associer", label: "Association" }, { id: "lecture", label: "Compréhension écrite" }, { id: "remise_ordre", label: "Remise en ordre" }, { id: "flashcards", label: "Flashcards" }, { id: "mots_meles", label: "Mots mêlés" }, { id: "kahoot_csv", label: "Questions Kahoot" }] },
  { id: "francais", label: "Français", emoji: "📖", color: "#AF52DE", niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"], types: [{ id: "lecture_fr", label: "Compréhension à la lecture" }, { id: "expression_ecrite", label: "Expression écrite" }, { id: "grammaire_fr", label: "Grammaire française" }, { id: "orthographe", label: "Orthographe / Dictée" }, { id: "analyse_texte", label: "Analyse de texte littéraire" }] },
  { id: "mathematiques", label: "Mathématiques", emoji: "📐", color: "#0A84FF", niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"], types: [{ id: "calcul", label: "Exercices de calcul" }, { id: "probleme", label: "Résolution de problèmes" }, { id: "geometrie", label: "Géométrie" }, { id: "algebre", label: "Algèbre / Équations" }, { id: "statistiques", label: "Statistiques" }] },
  { id: "sciences", label: "Sciences", emoji: "🔬", color: "#34C759", niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"], types: [{ id: "qcm_sc", label: "QCM Sciences" }, { id: "observation", label: "Observation / Expérience" }, { id: "schemas_sc", label: "Schémas légendés" }, { id: "protocole", label: "Protocole expérimental" }] },
  { id: "histoire", label: "Histoire", emoji: "🏛️", color: "#FF3B30", niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"], types: [{ id: "analyse_source", label: "Analyse de source" }, { id: "chronologie", label: "Chronologie" }, { id: "qcm_hist", label: "QCM Histoire" }, { id: "synthese_hist", label: "Synthèse historique" }] },
  { id: "geographie", label: "Géographie", emoji: "🗺️", color: "#00C7BE", niveaux: ["1S", "2S", "3S", "4S", "5S", "6S"], types: [{ id: "analyse_carte", label: "Analyse de carte" }, { id: "paysage", label: "Analyse de paysage / photo" }, { id: "qcm_geo", label: "QCM Géographie" }, { id: "croquis", label: "Croquis / Schéma géo" }] },
  { id: "en", label: "Anglais", emoji: "🇬🇧", color: "#5856D6", niveaux: ["A1", "A2", "B1", "B2"], types: [{ id: "lacunes", label: "Texte à trous" }, { id: "qcm", label: "QCM" }, { id: "conjugaison", label: "Conjugaison" }, { id: "dialogue", label: "Dialogue à compléter" }, { id: "traduction", label: "Traduction" }, { id: "lecture", label: "Compréhension écrite" }, { id: "flashcards", label: "Flashcards" }] },
];
const COMPETENCES_FWB = [
  { id: "audition", label: "Compreh. a l audition" },
  { id: "lecture", label: "Compreh. a la lecture" },
  { id: "expression_ecrite", label: "Expression ecrite" },
  { id: "orale_sans", label: "Expression orale (sans interaction)" },
  { id: "orale_avec", label: "Expression orale (avec interaction)" },
];

type CotationType = "points" | "nisbttb";
const COTATION_OPTIONS: { id: CotationType; label: string; desc: string }[] = [
  { id: "points", label: "/ Points", desc: "Note chiffrée (ex: /20)" },
  { id: "nisbttb", label: "NI / I / S / B / TB", desc: "Évaluation par compétences" },
];
type SchoolTemplate = { school_name: string; teacher_name: string; address: string; logo_url: string };
const DEFAULT_SCHOOL_TEMPLATE: SchoolTemplate = { school_name: "", teacher_name: "", address: "", logo_url: "" };
type IaSource = "pure" | "cours";
type PdfFormat = "klasbook" | "perso";

// ── NISBTTB helpers ──────────────────────────────────────────────────────────
const NISBTTB_OPTS = ["NI", "I", "S", "B", "TB"] as const;
type NisbttbLevel = typeof NISBTTB_OPTS[number];
const NISBTTB_COLORS: Record<NisbttbLevel, { bg: string; text: string; border: string }> = {
  NI: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
  I:  { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  S:  { bg: "#FEFCE8", text: "#854D0E", border: "#FEF08A" },
  B:  { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  TB: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
};

function NisbttbSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      <button
        onClick={() => onChange("")}
        style={{ height: 28, padding: "0 7px", borderRadius: 7, border: value === "" ? "2px solid #6B7280" : "1px solid #E5E7EB", background: value === "" ? "#F3F4F6" : "#FFF", fontSize: 11, fontWeight: 700, color: "#6B7280", cursor: "pointer" }}>
        —
      </button>
      {NISBTTB_OPTS.map(opt => {
        const c = NISBTTB_COLORS[opt];
        const active = value === opt;
        return (
          <button key={opt} onClick={() => onChange(opt)}
            style={{ height: 28, padding: "0 8px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 800,
              border: active ? `2px solid ${c.border}` : "1px solid #E5E7EB",
              background: active ? c.bg : "#FFF", color: active ? c.text : "#9CA3AF" }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Modal Créer ──────────────────────────────────────────────────────────────
function CreateModal({ ctx, classes, courses, apprentissages, onCreated, onClose }: {
  ctx: TeacherContext; classes: ClassGroup[]; courses: Course[]; apprentissages: Apprentissage[];
  onCreated: () => void; onClose: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssessmentType>("summative");
  const [date, setDate] = useState(toISODate(new Date()));
  const [maxPoints, setMaxPoints] = useState("20");
  const [cotation, setCotation] = useState<CotationType>("nisbttb");
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [parentVisible, setParentVisible] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [classId, setClassId] = useState<UUID | "">(classes[0]?.id ?? "");
  const [courseId, setCourseId] = useState<UUID | "">(courses[0]?.id ?? "");
  const [apprentissageId, setApprentissageId] = useState<UUID | "">("");
  const [selectedSubject, setSelectedSubject] = useState<SubjectDef>(SUBJECTS[0]);
  const [typeExercice, setTypeExercice] = useState(SUBJECTS[0].types[0].id);
  const [competenceFWB, setCompetenceFWB] = useState(COMPETENCES_FWB[0].id);
  const [competencesEvaluees, setCompetencesEvaluees] = useState<string[]>([]);
  const [niveau, setNiveau] = useState(SUBJECTS[0].niveaux[0]);
  const [iaSource, setIaSource] = useState<IaSource>("pure");
  const [coursProf, setCoursProf] = useState("");
  const [pdfFormat, setPdfFormat] = useState<PdfFormat>("klasbook");
  const [schoolTemplate, setSchoolTemplate] = useState<SchoolTemplate>(DEFAULT_SCHOOL_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplate() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_profiles").select("template_json, full_name").eq("id", user.id).maybeSingle();
      if (data) {
        const t = (data.template_json ?? {}) as Partial<SchoolTemplate>;
        setSchoolTemplate({ school_name: t.school_name ?? "", teacher_name: t.teacher_name ?? (data.full_name ?? ""), address: t.address ?? "", logo_url: t.logo_url ?? "" });
      }
    }
    void loadTemplate();
  }, [supabase]);

  useEffect(() => {
    if (!courses.length) return;
    const match = courses.find(c => c.name.toLowerCase().includes(selectedSubject.label.toLowerCase()));
    if (match) setCourseId(match.id);
  }, [selectedSubject, courses]);

  function handleSubjectChange(subj: SubjectDef) { setSelectedSubject(subj); setTypeExercice(subj.types[0].id); setNiveau(subj.niveaux[0]); }

  const inp: React.CSSProperties = { height: 40, padding: "0 12px", borderRadius: 9, border: "1px solid #E5E7EB", fontSize: 14, width: "100%", boxSizing: "border-box" };
  const sel: React.CSSProperties = { ...inp, cursor: "pointer", background: "#FFF" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" };
  function pillStyle(active: boolean): React.CSSProperties {
    return { flex: 1, padding: "8px 0", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700, border: active ? "2px solid #0A84FF" : "1.5px solid #E5E7EB", background: active ? "#EFF6FF" : "#FFF", color: active ? "#0A63BF" : "#374151" };
  }

  async function onSubmit() {
    if (!title.trim()) return setErr("Titre obligatoire.");
    if (!classId || !courseId) return setErr("Classe et cours obligatoires.");
    setSaving(true); setErr(null);
    try {
      await createAssessment({ ctx, title: title.trim(), type, date, max_points: cotation === "points" ? (Number(maxPoints) || 20) : null, weight: null, status, parent_visible: parentVisible, instructions: instructions.trim() || null, class_group_id: classId, course_id: courseId, apprentissage_id: apprentissageId || null, cotation_type: cotation, competences_evaluees: competencesEvaluees });
      onCreated(); onClose();
    } catch (e) { setErr(toNiceError(e)); } finally { setSaving(false); }
  }

  async function onGenerer() {
    if (!title.trim()) return setErr("Donne un titre à l'évaluation d'abord.");
    setGenerating(true); setErr(null); setGenResult(null);
    try {
      const theme = instructions.trim() ? `${title.trim()} — ${instructions.trim()}` : title.trim();
      const res = await fetch("/api/generer-exercice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: selectedSubject.id, langue: selectedSubject.id, type_exercice: typeExercice, competence_fwb: competenceFWB, niveau, theme, classe: classId ? classes.find(c => c.id === classId)?.name ?? "" : "", ...(iaSource === "cours" && coursProf.trim() ? { contexte_remediation: `COURS DU PROFESSEUR :\n${coursProf.trim()}` } : {}) }) });
      const data = await res.json() as { exercice?: string; titre?: string; id?: string | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setGenResult(data.exercice ?? "");
    } catch (e) { setErr(toNiceError(e)); } finally { setGenerating(false); }
  }

  async function onDownloadPDF() {
    if (!genResult) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PAGE_W = 210, ML = 15, MR = 15, CONTENT_W = PAGE_W - ML - MR;
    let y = 0;
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, PAGE_W, 8, "F");
    doc.setFillColor(10, 132, 255); doc.rect(0, 0, 60, 8, "F");
    y = 16;
    if (pdfFormat === "klasbook") {
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(15, 23, 42); doc.text("KLASBOOK", ML, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text(`${selectedSubject.emoji} ${selectedSubject.label}`, ML + 40, y); y += 7;
    } else {
      const schoolName = schoolTemplate.school_name || "Mon École";
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(15, 23, 42); doc.text(schoolName.toUpperCase(), ML, y); y += 5;
      if (schoolTemplate.address) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text(schoolTemplate.address, ML, y); y += 4; }
      if (schoolTemplate.teacher_name) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text(`Prof : ${schoolTemplate.teacher_name}`, ML, y); y += 4; }
      y += 3;
    }
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4); doc.line(ML, y, PAGE_W - MR, y); y += 5;
    const COL2 = ML + CONTENT_W / 2;
    doc.setFontSize(10); doc.setTextColor(15, 23, 42);
    const className = classId ? classes.find(c => c.id === classId)?.name ?? "—" : "—";
    const cotationLabel = cotation === "points" ? `       / ${maxPoints}` : "NI  /  I  /  S  /  B  /  TB";
    const infoRows: [string, string, string, string][] = [
      ["Matière :", selectedSubject.label, "Type :", type === "summative" ? "Sommative" : type === "formative" ? "Formative" : "Évaluation"],
      ["Classe :", className, "Date :", formatDateFR(date)],
      ["Nom / Prénom :", "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _", cotation === "points" ? "Points :" : "Niveau :", cotationLabel],
    ];
    for (const [label1, val1, label2, val2] of infoRows) {
      doc.setFont("helvetica", "bold"); doc.text(label1, ML, y); doc.setFont("helvetica", "normal"); doc.text(val1, ML + 28, y);
      doc.setFont("helvetica", "bold"); doc.text(label2, COL2, y); doc.setFont("helvetica", "normal"); doc.text(val2, COL2 + 22, y); y += 6;
    }
    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(10, 132, 255); doc.text(title.trim(), ML, y); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(genResult, CONTENT_W);
    for (const line of lines) { if (y > 280) { doc.addPage(); y = 15; } doc.text(line, ML, y); y += 5; }
    const pageCount = doc.getNumberOfPages();
    const footerLabel = pdfFormat === "klasbook" ? "Klasbook" : (schoolTemplate.school_name || "Mon École");
    for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.text(`${footerLabel} — ${selectedSubject.label} — ${formatDateFR(date)}`, ML, 290); doc.text(`${i} / ${pageCount}`, PAGE_W - MR - 10, 290); }
    doc.save(`eval-${selectedSubject.id}-${date}.pdf`);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "min(760px,96vw)", background: "#fff", borderRadius: 20, boxShadow: "0 24px 64px rgba(15,23,42,.28)", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "linear-gradient(135deg,#FF3B30,#0A84FF)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 900 }}>✏️ Nouvelle évaluation</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>
        <div style={{ padding: 22, display: "grid", gap: 12, overflowY: "auto" }}>
          {err && <div style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", color: "#991B1B", fontSize: 13 }}>{err}</div>}
          <div><div style={lbl}>Type d&apos;évaluation</div><div style={{ display: "flex", gap: 8 }}>{(["summative", "formative", "diag", "oral"] as const).map(t => (<button key={t} onClick={() => setType(t as AssessmentType)} style={pillStyle(type === t)}>{t === "summative" ? "🎓 Sommative" : t === "formative" ? "📊 Formative" : t === "diag" ? "🔍 Diag." : "🎤 Orale"}</button>))}</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><div style={lbl}>Matière *</div><select style={sel} value={selectedSubject.id} onChange={e => { const s = SUBJECTS.find(s => s.id === e.target.value); if (s) handleSubjectChange(s); }}>{SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}</select></div>
            <div><div style={lbl}>Classe / Année *</div><select style={sel} value={classId} onChange={e => setClassId(e.target.value as UUID)}><option value="">Choisir…</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          <div><div style={lbl}>Titre / Thème *</div><input style={{ ...inp, height: 44 }} placeholder="Ex: Vocabulaire — De familie" value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
          <div><div style={lbl}>Competence FWB</div><select style={sel} value={competenceFWB} onChange={e => setCompetenceFWB(e.target.value)}>{COMPETENCES_FWB.map(c2 => <option key={c2.id} value={c2.id}>{c2.label}</option>)}</select></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><div style={lbl}>Niveau</div><select style={sel} value={niveau} onChange={e => setNiveau(e.target.value)}>{selectedSubject.niveaux.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
            <div><div style={lbl}>Type d&apos;exercice</div><select style={sel} value={typeExercice} onChange={e => setTypeExercice(e.target.value)}>{selectedSubject.types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid #E5E7EB", padding: "12px 14px", background: "#FAFAFA" }}>
            <div style={lbl}>Source pour l&apos;IA</div>
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setIaSource("pure")} style={pillStyle(iaSource === "pure")}>✨ IA pure</button><button onClick={() => setIaSource("cours")} style={pillStyle(iaSource === "cours")}>📚 Basé sur mon cours</button></div>
            {iaSource === "cours" && <textarea style={{ ...inp, height: 80, resize: "vertical", paddingTop: 9, marginTop: 10, background: "#fff" }} placeholder="Colle ici les notes de cours…" value={coursProf} onChange={e => setCoursProf(e.target.value)} />}
          </div>
          <div>
            <div style={lbl}>Système de cotation</div>
            <div style={{ display: "flex", gap: 8 }}>
              {COTATION_OPTIONS.map(opt => (<button key={opt.id} onClick={() => setCotation(opt.id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700, border: cotation === opt.id ? "2px solid #0A84FF" : "1.5px solid #E5E7EB", background: cotation === opt.id ? "#EFF6FF" : "#FFF", color: cotation === opt.id ? "#0A63BF" : "#374151", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><span>{opt.label}</span><span style={{ fontSize: 10, fontWeight: 500, color: "#9CA3AF" }}>{opt.desc}</span></button>))}
            </div>
          </div>
          {cotation === "nisbttb" && (<div><div style={lbl}>Competences evaluees</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{COMPETENCES_FWB.map(comp => (<label key={comp.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer", padding: "5px 10px", borderRadius: 8, background: competencesEvaluees.includes(comp.id) ? "#EFF6FF" : "#F9FAFB", border: competencesEvaluees.includes(comp.id) ? "1.5px solid #0A84FF" : "1px solid #E5E7EB" }}><input type="checkbox" checked={competencesEvaluees.includes(comp.id)} onChange={ev => setCompetencesEvaluees(prev => ev.target.checked ? [...prev, comp.id] : prev.filter(x => x !== comp.id))} />{comp.label}</label>))}</div></div>)}
          <div style={{ display: "grid", gridTemplateColumns: cotation === "points" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
            <div><div style={lbl}>Date</div><input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} /></div>
            {cotation === "points" && (<div><div style={lbl}>Points max</div><input style={inp} value={maxPoints} onChange={e => setMaxPoints(e.target.value)} inputMode="numeric" placeholder="20" /></div>)}
            <div><div style={lbl}>Statut</div><select style={sel} value={status} onChange={e => setStatus(e.target.value as ContentStatus)}><option value="draft">Brouillon</option><option value="published">Publiée</option><option value="archived">Archivée</option></select></div>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid #E5E7EB", padding: "12px 14px", background: "#FAFAFA" }}>
            <div style={lbl}>Format de sortie PDF</div>
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setPdfFormat("klasbook")} style={pillStyle(pdfFormat === "klasbook")}>🏫 Canevas Klasbook</button><button onClick={() => setPdfFormat("perso")} style={pillStyle(pdfFormat === "perso")}>🎨 Canevas personnalisé</button></div>
            {pdfFormat === "perso" && (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><div><div style={{ ...lbl, marginBottom: 4 }}>Nom de l&apos;école</div><input style={{ ...inp, background: "#fff" }} value={schoolTemplate.school_name} onChange={e => setSchoolTemplate(t => ({ ...t, school_name: e.target.value }))} placeholder="Ex: Athénée Royal de…" /></div><div><div style={{ ...lbl, marginBottom: 4 }}>Nom du professeur</div><input style={{ ...inp, background: "#fff" }} value={schoolTemplate.teacher_name} onChange={e => setSchoolTemplate(t => ({ ...t, teacher_name: e.target.value }))} placeholder="Ex: M. Dupont" /></div><div style={{ gridColumn: "1 / -1" }}><div style={{ ...lbl, marginBottom: 4 }}>Adresse</div><input style={{ ...inp, background: "#fff" }} value={schoolTemplate.address} onChange={e => setSchoolTemplate(t => ({ ...t, address: e.target.value }))} placeholder="Ex: Rue de la Loi 1, 1000 Bruxelles" /></div></div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><div style={lbl}>Apprentissage</div><select style={sel} value={apprentissageId} onChange={e => setApprentissageId(e.target.value as UUID | "")}><option value="">Aucun</option>{apprentissages.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}><label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}><input type="checkbox" checked={parentVisible} onChange={e => setParentVisible(e.target.checked)} style={{ width: 15, height: 15 }} />Visible parents</label></div>
          </div>
          <div><div style={lbl}>Instructions / Consignes (optionnel)</div><textarea style={{ ...inp, height: 68, resize: "vertical", paddingTop: 9 }} placeholder="Ex: Vocabulaire de la famille…" value={instructions} onChange={e => setInstructions(e.target.value)} /></div>
          {genResult && (<div style={{ borderRadius: 12, border: "1px solid #BBF7D0", background: "#F0FDF4", padding: "12px 14px", fontSize: 13, color: "#166534", maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap" }}>{genResult}</div>)}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 4, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onGenerer} disabled={generating || !title.trim()} style={{ height: 42, padding: "0 16px", borderRadius: 9, border: "none", background: generating || !title.trim() ? "#E5E7EB" : "linear-gradient(135deg,#AF52DE,#0A84FF)", color: generating || !title.trim() ? "#9CA3AF" : "#fff", fontWeight: 700, fontSize: 13, cursor: generating || !title.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>{generating ? "⏳ Génération…" : "✨ Générer avec IA"}</button>
              {genResult && (<button onClick={onDownloadPDF} style={{ height: 42, padding: "0 16px", borderRadius: 9, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#166534", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>📄 {pdfFormat === "klasbook" ? "PDF Klasbook" : "PDF personnalisé"}</button>)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Annuler</button>
              <button onClick={onSubmit} disabled={saving} style={{ height: 42, padding: "0 20px", borderRadius: 9, border: "none", background: saving ? "#9CA3AF" : "linear-gradient(135deg,#FF3B30,#0A84FF)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Enregistrement…" : "✓ Créer l'évaluation"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card évaluation ──────────────────────────────────────────────────────────
function AssessmentCard({ a, apprentissageNameById, highlighted, onToggleStatus, onArchive, onDelete, onRefresh, ctx }: {
  a: Assessment; apprentissageNameById: Map<string, string>; highlighted: boolean;
  onToggleStatus: (a: Assessment) => void; onArchive: (a: Assessment) => void; onDelete: (id: UUID) => void;
  onRefresh: () => void; ctx: TeacherContext;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [gridModalOpen, setGridModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(a.date);
  const [savingDate, setSavingDate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isFormative = a.type === "formative";

  async function commitDate() {
    if (!dateValue || dateValue === a.date) { setEditingDate(false); return; }
    setSavingDate(true);
    try { await updateAssessment({ ctx, assessmentId: a.id, patch: { date: dateValue } }); onRefresh(); }
    finally { setSavingDate(false); setEditingDate(false); }
  }

  async function handleUpload(file: File) {
    setUploading(true); setUploadMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("assessmentId", a.id);
      const res = await fetch("/api/evaluations/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadMsg("✅ Fichier uploadé"); setTimeout(() => setUploadMsg(null), 3000); onRefresh();
    } catch (e) { setUploadMsg("❌ " + (e instanceof Error ? e.message : "Erreur")); }
    finally { setUploading(false); }
  }

  async function handleDownload() {
    if (!a.fichier_path) return;
    const res = await fetch(`/api/evaluations/upload?path=${encodeURIComponent(a.fichier_path)}`);
    const data = await res.json();
    if (data.url) { window.open(data.url, "_blank"); }
  }

  async function handleDeleteFile() {
    if (!a.fichier_path) return;
    const res = await fetch(`/api/evaluations/upload?assessmentId=${a.id}&path=${encodeURIComponent(a.fichier_path)}`, { method: "DELETE" });
    if (res.ok) { onRefresh(); }
  }

  const isPublished = a.status === "published";
  const isArchived = a.status === "archived";
  const typeColor = isFormative ? { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" } : { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" };
  const abtn = (bg: string, color: string, border: string): React.CSSProperties => ({ height: 28, padding: "0 10px", borderRadius: 8, border: `1px solid ${border}`, background: bg, cursor: "pointer", fontSize: 11, fontWeight: 700, color, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 });

  return (
    <>
    <div id={`card-${a.id}`} style={{ background: "#FFF", borderRadius: 14, border: highlighted ? "2px solid #0A84FF" : "1px solid #E5E7EB", boxShadow: highlighted ? "0 0 0 4px rgba(10,132,255,.1)" : "0 1px 3px rgba(0,0,0,.05)", padding: "14px 16px", transition: "box-shadow .3s", opacity: isArchived ? 0.7 : 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        {!isArchived && (<button onClick={() => onToggleStatus(a)} style={abtn(isPublished ? "#FFFBEB" : "#F0FDF4", isPublished ? "#92400E" : "#166534", isPublished ? "#FDE68A" : "#BBF7D0")}>{isPublished ? "↩ Brouillon" : "✓ Publier"}</button>)}
        {isArchived && (<button onClick={() => onToggleStatus(a)} style={abtn("#F0FDF4", "#166534", "#BBF7D0")}>↩ Restaurer</button>)}
        {!isArchived && <div style={{ width: 1, height: 20, background: "#E5E7EB", margin: "0 2px" }} />}
        <button onClick={() => setGridModalOpen(true)} style={abtn("#FFFBEB", "#92400E", "#FDE68A")}>📋 Grille</button>
        <button onClick={() => setCorrectionModalOpen(true)} style={abtn("#F0F9FF", "#0C4A6E", "#BAE6FD")}>📷 Corriger</button>
        <button onClick={() => setResultsModalOpen(true)} style={abtn("#ECFDF5", "#065F46", "#A7F3D0")}>📊 Résultats</button>
        <button onClick={() => setImportModalOpen(true)} style={abtn("#F0F9FF", "#0369A1", "#BAE6FD")}>📥 Import</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
          {isPublished && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>✓ Publiée</span>}
          {a.status === "draft" && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>Brouillon</span>}
          {isArchived && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB" }}>Archivée</span>}
          {a.parent_visible && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>👪 Parents</span>}
          {a.template_id && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#EDE9FE", color: "#5B21B6", border: "1px solid #DDD6FE" }}>📚 Modèle</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: typeColor.bg, border: `1px solid ${typeColor.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{isFormative ? "📊" : "🎓"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}><span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: typeColor.bg, color: typeColor.text, border: `1px solid ${typeColor.border}` }}>{isFormative ? "Formative" : "Sommative"}</span></div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{a.title}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#6B7280", fontWeight: 500, alignItems: "center" }}>
            {a.date && (editingDate ? (<input type="date" value={dateValue} autoFocus disabled={savingDate} onChange={e => setDateValue(e.target.value)} onBlur={() => void commitDate()} onKeyDown={e => { if (e.key === "Enter") void commitDate(); if (e.key === "Escape") { setDateValue(a.date); setEditingDate(false); } }} style={{ height: 26, padding: "0 8px", borderRadius: 7, border: "1.5px solid #0A84FF", fontSize: 12, outline: "none", background: "#EFF6FF" }} />) : (<span style={{ display: "flex", alignItems: "center", gap: 4 }}>📅 {formatDateFR(a.date)}<button onClick={() => { setDateValue(a.date); setEditingDate(true); }} title="Modifier la date" style={{ height: 18, width: 18, borderRadius: 5, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", padding: 0 }}>✏</button></span>))}
            {a.max_points && <span>🎯 {a.max_points} pts</span>}
            {a.cotation_type === "nisbttb" && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>NI/I/S/B/TB</span>}
            {a.apprentissage_id && apprentissageNameById.get(a.apprentissage_id) && (<span>📖 {apprentissageNameById.get(a.apprentissage_id)}</span>)}
          </div>
          {a.instructions && (<div style={{ marginTop: 6, fontSize: 12, color: "#6B7280", background: "#F9FAFB", borderRadius: 8, padding: "4px 8px", fontStyle: "italic" }}>{a.instructions}</div>)}
          <div style={{ marginTop: 8 }}>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
            {a.fichier_path ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0" }}>
                <span style={{ fontSize: 14 }}>📎</span><span style={{ fontSize: 12, fontWeight: 600, color: "#166534", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fichier_nom}</span>
                <button onClick={handleDownload} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid #BBF7D0", background: "#DCFCE7", color: "#166534", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>⬇ Ouvrir</button>
                <button onClick={handleDeleteFile} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid #FECACA", background: "#FEF2F2", color: "#B91C1C", cursor: "pointer", fontWeight: 600 }}>✕</button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, border: "1.5px dashed #D1D5DB", background: uploading ? "#F9FAFB" : "#FFF", color: "#9CA3AF", fontSize: 12, cursor: uploading ? "not-allowed" : "pointer", fontWeight: 500 }}>
                <span>📎</span>{uploading ? "Upload en cours…" : "Joindre un fichier PDF / Word"}
              </button>
            )}
            {uploadMsg && <div style={{ fontSize: 11, marginTop: 3, color: uploadMsg.startsWith("✅") ? "#166534" : "#B91C1C" }}>{uploadMsg}</div>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
        {!isArchived && (<button onClick={() => onArchive(a)} style={{ flex: 1, height: 32, borderRadius: 9, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>🗄 Archiver</button>)}
        {!confirmDelete ? (<button onClick={() => setConfirmDelete(true)} style={{ flex: 1, height: 32, borderRadius: 9, border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>🗑 Supprimer</button>) : (
          <div style={{ flex: 1, display: "flex", gap: 5 }}>
            <button onClick={() => onDelete(a.id)} style={{ flex: 1, height: 32, borderRadius: 9, border: "1px solid #F87171", background: "#FEF2F2", cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#B91C1C" }}>✓ Confirmer suppression</button>
            <button onClick={() => setConfirmDelete(false)} style={{ height: 32, width: 32, borderRadius: 9, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#6B7280" }}>×</button>
          </div>
        )}
      </div>
    </div>
    {resultsModalOpen && <ResultsModal a={a} ctx={ctx} onClose={() => setResultsModalOpen(false)} />}
    {importModalOpen && <ImportResultsModal a={a} ctx={ctx} onClose={() => setImportModalOpen(false)} onImported={() => { onRefresh(); setImportModalOpen(false); }} />}
    {gridModalOpen && <GridEditorModal a={a} ctx={ctx} onClose={() => setGridModalOpen(false)} />}
    {correctionModalOpen && <CorrectionModal a={a} ctx={ctx} onClose={() => setCorrectionModalOpen(false)} />}
    </>
  );
}

// ── ImportResultsModal ───────────────────────────────────────────────────────
function ImportResultsModal({ a, ctx, onClose, onImported }: { a: Assessment; ctx: TeacherContext; onClose: () => void; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<ParsedAssessmentResultCsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<AssessmentResultCsvImportSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    setRows([]); setSummary(null); setErr(null); setFileName(file?.name ?? "");
    if (!file) return;
    try {
      let text: string;
      if (file.name.match(/\.xlsx?$/i)) {
        const { read, utils } = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = read(buf); const ws = wb.Sheets[wb.SheetNames[0]];
        const arr = utils.sheet_to_csv(ws); text = arr;
      } else { text = await file.text(); }
      setRows(parseAssessmentResultsCsv(text));
    } catch (e) { setErr(toNiceError(e)); }
  }

  async function doImport() {
    if (!rows.length) return;
    setImporting(true); setErr(null);
    try {
      const { data: classes } = await ctx.supabase.from("class_groups").select("id, name").eq("school_id", ctx.schoolId);
      const s = await importAssessmentResultsCsv({ ctx, rows, classes: (classes ?? []) as unknown as ClassGroup[], targetAssessmentId: a.id });
      setSummary(s);
      if (s.errors.length === 0) setTimeout(onImported, 1500);
    } catch (e) { setErr(toNiceError(e)); } finally { setImporting(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 480, maxWidth: "96vw", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📥 Import résultats — {a.title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>Importe un fichier CSV ou Excel avec les résultats des élèves pour cette évaluation. Colonnes attendues : <strong>prénom, nom, résultat</strong> (NI/I/S/B/TB ou note).</p>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => void handleFile(e.target.files?.[0] ?? null)} />
        <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${fileName ? "#0369A1" : "#D1D5DB"}`, borderRadius: 10, padding: "16px 24px", cursor: "pointer", textAlign: "center", background: fileName ? "#F0F9FF" : "#FAFAFA", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: fileName ? "#0369A1" : "#6B7280" }}>{fileName || "Cliquer pour choisir un fichier CSV ou Excel"}</div>
          {rows.length > 0 && <div style={{ fontSize: 11, color: "#0369A1", marginTop: 4 }}>{rows.length} ligne(s) détectée(s)</div>}
        </div>
        {err && <div style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>{err}</div>}
        {summary && <div style={{ fontSize: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 12px", marginBottom: 10, color: "#166534" }}>✅ Importés : {summary.upserted} · Doublons : {summary.duplicatedInFile} · Erreurs : {summary.errors.length}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={doImport} disabled={!rows.length || importing} style={{ padding: "9px 20px", borderRadius: 8, background: !rows.length || importing ? "#9CA3AF" : "#0369A1", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: !rows.length || importing ? "not-allowed" : "pointer" }}>{importing ? "Import…" : `Importer (${rows.length})`}</button>
        </div>
      </div>
    </div>
  );
}

// ── GridEditorModal ───────────────────────────────────────────────────────────
type GridQuestion = { id: string; num: number; text: string; type: "qcm" | "open" | "fill" | "points"; points: number; competence: string; expected_answer: string; options: string };
const COMP_LABELS: Record<string, string> = { "": "—", audition: "Audition", lecture: "Lecture", expression_ecrite: "Écrite", orale_sans: "Orale (sans)", orale_avec: "Orale (avec)" };
function newQuestion(num: number): GridQuestion { return { id: `q${Date.now()}`, num, text: "", type: "open", points: 1, competence: "", expected_answer: "", options: "" }; }

function GridEditorModal({ a, ctx, onClose }: { a: Assessment; ctx: TeacherContext; onClose: () => void }) {
  const [questions, setQuestions] = useState<GridQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { fetch(`/api/evaluations/grid?assessment_id=${a.id}`).then(r => r.json()).then(d => { setQuestions((d.questions ?? []) as GridQuestion[]); setLoaded(true); }).catch(() => setLoaded(true)); }, []);
  function addQ() { setQuestions(prev => [...prev, newQuestion(prev.length + 1)]); }
  function removeQ(id: string) { setQuestions(prev => prev.filter(q => q.id !== id).map((q, i) => ({ ...q, num: i + 1 }))); }
  function updateQ(id: string, patch: Partial<GridQuestion>) { setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q)); }
  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/evaluations/grid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessment_id: a.id, questions }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setMsg("✅ Grille sauvegardée"); setTimeout(onClose, 1200);
    } catch (e) { setMsg("❌ " + (e instanceof Error ? e.message : "Erreur")); }
    finally { setSaving(false); }
  }
  const totalPts = questions.reduce((s, q) => s + Number(q.points || 0), 0);
  const inp: React.CSSProperties = { border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 8px", fontSize: 12, width: "100%" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 820, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>📋 Grille de correction — {a.title}</h2><button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button></div>
        {!loaded ? <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>Chargement…</div> : (
          <>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>Définis les questions, les réponses attendues et les points.</div>
            {questions.map((q, i) => (<div key={q.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", marginBottom: 10, background: "#FAFAFA" }}><div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 800, color: "#6D28D9", minWidth: 24 }}>Q{i + 1}</span><input value={q.text} onChange={e => updateQ(q.id, { text: e.target.value })} placeholder="Texte de la question…" style={{ ...inp, flex: 3 }} /><select value={q.type} onChange={e => updateQ(q.id, { type: e.target.value as GridQuestion["type"] })} style={{ ...inp, flex: 1 }}><option value="open">Ouverte</option><option value="qcm">QCM</option><option value="fill">Texte à trous</option><option value="points">Points libres</option></select><input type="number" value={q.points} onChange={e => updateQ(q.id, { points: Number(e.target.value) })} min={0} step={0.5} style={{ ...inp, width: 60 }} placeholder="pts" /><select value={q.competence} onChange={e => updateQ(q.id, { competence: e.target.value })} style={{ ...inp, flex: 1 }}>{Object.entries(COMP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><button onClick={() => removeQ(q.id)} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 16, cursor: "pointer", fontWeight: 800 }}>×</button></div><div style={{ display: "flex", gap: 8 }}><input value={q.expected_answer} onChange={e => updateQ(q.id, { expected_answer: e.target.value })} placeholder="Réponse attendue" style={{ ...inp, flex: 2 }} />{q.type === "qcm" && (<input value={q.options} onChange={e => updateQ(q.id, { options: e.target.value })} placeholder="Options séparées par | " style={{ ...inp, flex: 3 }} />)}</div></div>))}
            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
              <button onClick={addQ} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #6D28D9", background: "#F5F3FF", color: "#6D28D9", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Ajouter une question</button>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>Total : {totalPts} pt{totalPts > 1 ? "s" : ""}</span>
              <button onClick={save} disabled={saving || !questions.length} style={{ padding: "8px 22px", borderRadius: 8, background: "#6D28D9", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{saving ? "Sauvegarde…" : "💾 Sauvegarder la grille"}</button>
            </div>
            {msg && <div style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ── CorrectionModal ───────────────────────────────────────────────────────────
type QuestionExtraction = { question_id: string; student_answer: string; suggested_score: number; max_score: number; needs_review: boolean; illegible?: boolean; note?: string };
type StudentExtraction = { name: string; page_hint?: string; answers: QuestionExtraction[]; total_suggested: number; total_max: number; score_sur_10?: number };

function CorrectionModal({ a, ctx, onClose }: { a: Assessment; ctx: TeacherContext; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "processing" | "review" | "saving" | "done">("upload");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [correctionKeyFile, setCorrectionKeyFile] = useState<File | null>(null);
  const [extractions, setExtractions] = useState<StudentExtraction[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const keyRef = useRef<HTMLInputElement | null>(null);
  function setScore(sn: string, qId: string, val: number) { setOverrides(prev => ({ ...prev, [sn]: { ...(prev[sn] ?? {}), [qId]: val } })); }
  function getScore(sn: string, qId: string, def: number) { return overrides[sn]?.[qId] ?? def; }
  function getTotal10(stud: StudentExtraction) { const total = stud.answers.reduce((s, ans) => s + getScore(stud.name, ans.question_id, ans.suggested_score), 0); return Math.round((total / (stud.total_max || 1)) * 100) / 10; }
  async function startCorrection() {
    if (!pdfFile) return;
    setStep("processing"); setErrorMsg(null);
    try {
      const form = new FormData(); form.append("pdf", pdfFile); form.append("assessment_id", a.id);
      if (correctionKeyFile) form.append("correction_key", correctionKeyFile);
      const res = await fetch("/api/evaluations/correct", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
      setExtractions(data.students ?? []); setStep("review");
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Erreur"); setStep("upload"); }
  }
  async function saveAll() {
    setStep("saving");
    try {
      const { data: enr } = await ctx.supabase.from("student_enrollments").select("student_id, students(id, first_name, last_name)").eq("class_group_id", a.class_group_id ?? "");
      const studMap: Record<string, string> = {};
      for (const e of enr ?? []) { const s = (e as any).students; if (s) studMap[`${s.first_name} ${s.last_name}`.toLowerCase()] = s.id; }
      for (const stud of extractions) {
        const nameKey = stud.name.toLowerCase();
        const matchKey = Object.keys(studMap).find(k => nameKey.includes(k) || k.includes(nameKey));
        const studentId = matchKey ? studMap[matchKey] : null;
        if (!studentId) continue;
        const total = stud.answers.reduce((s, ans) => s + getScore(stud.name, ans.question_id, ans.suggested_score), 0);
        await upsertResult({ ctx, assessmentId: a.id, studentId, value: total, level: null, competencyScores: {} });
      }
      setStep("done");
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Erreur lors de la sauvegarde"); setStep("review"); }
  }
  const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" };
  const boxStyle: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 28, width: 960, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" };
  if (step === "done") return (<div style={overlayStyle}><div style={{ ...boxStyle, textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>✅</div><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Résultats enregistrés !</div><div style={{ display: "flex", gap: 10, justifyContent: "center" }}><button onClick={onClose} style={{ padding: "10px 22px", borderRadius: 10, background: "#F3F4F6", color: "#374151", border: "none", fontWeight: 700, cursor: "pointer" }}>Fermer</button><button onClick={() => { onClose(); router.push(`/resultats?view=evaluation&classId=${a.class_group_id ?? ""}&assessmentId=${a.id}`); }} style={{ padding: "10px 22px", borderRadius: 10, background: "#0C4A6E", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>📊 Voir dans Résultats</button></div></div></div>);
  return (
    <div style={overlayStyle}><div style={boxStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>📷 Correction automatique — {a.title}</h2><button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button></div>
      {(step === "upload" || step === "processing") && (<div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "12px 0" }}>
        <div><div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>📋 Corrigé officiel <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optionnel)</span></div><div onClick={() => keyRef.current?.click()} style={{ border: `2px dashed ${correctionKeyFile ? "#16A34A" : "#D1D5DB"}`, borderRadius: 10, padding: "16px 24px", cursor: "pointer", textAlign: "center", background: correctionKeyFile ? "#F0FDF4" : "#FAFAFA" }}><div style={{ fontSize: 13, fontWeight: 600, color: correctionKeyFile ? "#166534" : "#6B7280" }}>{correctionKeyFile ? correctionKeyFile.name : "Cliquer pour ajouter le corrigé (PDF)"}</div></div><input ref={keyRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setCorrectionKeyFile(e.target.files?.[0] ?? null)} /></div>
        <div><div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>📚 Copies des élèves <span style={{ color: "#B91C1C" }}>*</span></div><div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${pdfFile ? "#2563EB" : "#D1D5DB"}`, borderRadius: 10, padding: "20px 24px", cursor: "pointer", textAlign: "center", background: pdfFile ? "#EFF6FF" : "#FAFAFA" }}><div style={{ fontSize: 13, fontWeight: 600, color: pdfFile ? "#1D4ED8" : "#374151" }}>{pdfFile ? pdfFile.name : "Cliquer pour sélectionner le PDF des copies"}</div></div><input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setPdfFile(e.target.files?.[0] ?? null)} /></div>
        {errorMsg && <div style={{ color: "#B91C1C", fontSize: 13, background: "#FEF2F2", padding: "8px 14px", borderRadius: 8 }}>{errorMsg}</div>}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button onClick={startCorrection} disabled={!pdfFile || step === "processing"} style={{ padding: "11px 32px", borderRadius: 10, background: (!pdfFile || step === "processing") ? "#9CA3AF" : "#0C4A6E", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: (!pdfFile || step === "processing") ? "not-allowed" : "pointer" }}>{step === "processing" ? "⏳ L'IA analyse les copies…" : "🚀 Lancer la correction IA"}</button>
        </div>
      </div>)}
      {step === "review" && (<>
        {extractions.map(stud => { const total = stud.answers.reduce((s, ans) => s + getScore(stud.name, ans.question_id, ans.suggested_score), 0); const sur10 = getTotal10(stud);
          return (<div key={stud.name} style={{ border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ background: "#F3F4F6", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 700 }}>{stud.name}</span><span style={{ fontWeight: 900, fontSize: 16, color: "#fff", background: sur10 >= 7 ? "#166534" : sur10 >= 5 ? "#D97706" : "#DC2626", borderRadius: 8, padding: "3px 10px" }}>{sur10.toFixed(1)} / 10</span></div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ background: "#FAFAFA" }}><th style={{ textAlign: "left", padding: "5px 10px", borderBottom: "1px solid #E5E7EB", width: 40 }}>Q</th><th style={{ textAlign: "left", padding: "5px 10px", borderBottom: "1px solid #E5E7EB" }}>Réponse</th><th style={{ padding: "5px 10px", borderBottom: "1px solid #E5E7EB", width: 70 }}>Score</th><th style={{ padding: "5px 10px", borderBottom: "1px solid #E5E7EB", width: 50 }}>Max</th></tr></thead>
            <tbody>{stud.answers.map(ans => (<tr key={ans.question_id} style={{ borderBottom: "1px solid #F3F4F6" }}><td style={{ padding: "5px 10px", fontWeight: 700, color: "#6D28D9" }}>{ans.question_id}</td><td style={{ padding: "5px 10px" }}>{ans.student_answer || <em style={{ color: "#9CA3AF" }}>Non répondu</em>}</td><td style={{ padding: "5px 10px", textAlign: "center" }}><input type="number" min={0} max={ans.max_score} step={0.5} value={getScore(stud.name, ans.question_id, ans.suggested_score)} onChange={e => setScore(stud.name, ans.question_id, Number(e.target.value))} style={{ width: 52, textAlign: "center", border: "1px solid #D1D5DB", borderRadius: 6, padding: "2px 4px" }} /></td><td style={{ padding: "5px 10px", textAlign: "center", color: "#9CA3AF" }}>{ans.max_score}</td></tr>))}</tbody></table>
          </div>);
        })}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={() => setStep("upload")} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Recommencer</button>
          <button onClick={saveAll} style={{ padding: "9px 24px", borderRadius: 8, background: "#166534", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✅ Valider et enregistrer</button>
        </div>
      </>)}
      {step === "saving" && (<div style={{ textAlign: "center", padding: "32px 0" }}><div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div><div style={{ fontSize: 14, color: "#6B7280" }}>Enregistrement…</div></div>)}
    </div></div>
  );
}

// ── ResultsModal — CORRIGÉ ───────────────────────────────────────────────────
function ResultsModal({ a, ctx, onClose }: { a: Assessment; ctx: TeacherContext; onClose: () => void }) {
  const router = useRouter();
  const [students, setStudents] = useState<Array<{ id: UUID; display_name: string }>>([]);
  const [scores, setScores] = useState<Record<UUID, { value: string; level: string; competencyScores: Record<string, string> }>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Logique d'affichage : nisbttb si cotation_type = nisbttb OU pas de compétences
  const isNisbttb = a.cotation_type === "nisbttb";
  const hasComps = isNisbttb && (a.competences_evaluees ?? []).length > 0;
  const compLabels: Record<string, string> = { audition: "Audition", lecture: "Lecture", expression_ecrite: "Écrite", orale_sans: "Orale (sans)", orale_avec: "Orale (avec)" };

  useEffect(() => {
    async function load() {
      if (!a.class_group_id) return;
      const { data: enr } = await ctx.supabase.from("student_enrollments").select("student_id").eq("class_group_id", a.class_group_id);
      const studentIds = (enr ?? []).map((e: any) => e.student_id).filter(Boolean);
      if (!studentIds.length) return;
      const { data: studsData } = await ctx.supabase.from("students").select("id, first_name, last_name").in("id", studentIds).order("last_name");
      const studs = (studsData ?? []).map((s: any) => ({ id: s.id as UUID, display_name: `${s.last_name ?? ""} ${s.first_name ?? ""}`.trim() }));
      setStudents(studs);
      const existing = await listResultsForAssessment({ ctx, assessmentId: a.id });
      const init: typeof scores = {};
      for (const s of studs) {
        const ex = existing.find(r => r.student_id === s.id);
        const cs: Record<string, string> = {};
        for (const comp of (a.competences_evaluees ?? [])) { cs[comp] = ex?.competency_scores?.[comp] != null ? String(ex.competency_scores[comp]) : ""; }
        init[s.id] = { value: ex?.value != null ? String(ex.value) : "", level: (ex as any)?.level ?? "", competencyScores: cs };
      }
      setScores(init);
    }
    void load();
  }, []);

  async function handleSave() {
    setSaving(true); setMsg(null);
    try {
      for (const s of students) {
        const row = scores[s.id];
        if (!row) continue;
        let val: number | null = null;
        let lvl: string | null = null;
        const cs: Record<string, string | number> = {};
        if (isNisbttb && !hasComps) {
          lvl = row.level !== "" ? row.level : null;
        } else if (!isNisbttb && !hasComps) {
          val = row.value !== "" ? Number(row.value) : null;
        } else {
          for (const [k, v] of Object.entries(row.competencyScores)) { if (v !== "") cs[k] = isNisbttb ? v : Number(v); }
          if (!isNisbttb) val = row.value !== "" ? Number(row.value) : null;
        }
        await upsertResult({ ctx, assessmentId: a.id, studentId: s.id, value: val, level: lvl, competencyScores: cs });
      }
      setMsg("✅ Résultats sauvegardés");
    } catch (e) { setMsg("❌ " + (e instanceof Error ? e.message : "Erreur")); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, minWidth: 520, maxWidth: 860, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📊 Résultats — {a.title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        {/* Badge cotation */}
        <div style={{ marginBottom: 14, fontSize: 12, color: isNisbttb ? "#1D4ED8" : "#166534", background: isNisbttb ? "#EFF6FF" : "#F0FDF4", border: `1px solid ${isNisbttb ? "#BFDBFE" : "#BBF7D0"}`, borderRadius: 8, padding: "5px 12px", display: "inline-block", fontWeight: 600 }}>
          {isNisbttb ? "Cotation : NI / I / S / B / TB" : `Cotation : /${a.max_points ?? "?"} points`}
        </div>
        {students.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun élève inscrit dans cette classe.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #E5E7EB" }}>Élève</th>
                {!hasComps && !isNisbttb && <th style={{ padding: "6px 10px", borderBottom: "1px solid #E5E7EB", textAlign: "center" }}>Note /{a.max_points ?? "?"}</th>}
                {!hasComps && isNisbttb && <th style={{ padding: "6px 10px", borderBottom: "1px solid #E5E7EB", textAlign: "center" }}>Niveau</th>}
                {hasComps && (a.competences_evaluees ?? []).map(c => (<th key={c} style={{ padding: "6px 8px", borderBottom: "1px solid #E5E7EB", textAlign: "center" }}>{compLabels[c] ?? c}</th>))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600 }}>{s.display_name}</td>
                  {!hasComps && !isNisbttb && (
                    <td style={{ padding: "5px 10px", textAlign: "center" }}>
                      <input type="number" min={0} max={a.max_points ?? undefined} value={scores[s.id]?.value ?? ""}
                        onChange={e => setScores(prev => ({ ...prev, [s.id]: { ...prev[s.id], value: e.target.value } }))}
                        style={{ width: 60, textAlign: "center", border: "1px solid #D1D5DB", borderRadius: 6, padding: "3px 6px" }} />
                    </td>
                  )}
                  {!hasComps && isNisbttb && (
                    <td style={{ padding: "5px 10px", textAlign: "center" }}>
                      <NisbttbSelect value={scores[s.id]?.level ?? ""} onChange={v => setScores(prev => ({ ...prev, [s.id]: { ...prev[s.id], level: v } }))} />
                    </td>
                  )}
                  {hasComps && (a.competences_evaluees ?? []).map(c => (
                    <td key={c} style={{ padding: "5px 8px", textAlign: "center" }}>
                      <NisbttbSelect value={scores[s.id]?.competencyScores?.[c] ?? ""} onChange={v => setScores(prev => ({ ...prev, [s.id]: { ...prev[s.id], competencyScores: { ...prev[s.id]?.competencyScores, [c]: v } } }))} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "8px 20px", borderRadius: 8, background: "#6D28D9", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            {saving ? "Sauvegarde…" : "💾 Sauvegarder"}
          </button>
          {msg && <span style={{ fontSize: 13 }}>{msg}</span>}
          {msg?.startsWith("✅") && (
            <button onClick={() => { onClose(); router.push(`/resultats?view=evaluation&classId=${a.class_group_id ?? ""}&assessmentId=${a.id}`); }}
              style={{ padding: "8px 18px", borderRadius: 8, background: "#0C4A6E", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              📊 Voir dans Résultats
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal Distribuer ─────────────────────────────────────────────────────────
function getTomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return toISODate(d); }

function DistributeModal({ tpl, classes, ctx, onDone, onClose }: { tpl: EvaluationTemplate; classes: ClassGroup[]; ctx: TeacherContext; onDone: (count: number) => void; onClose: () => void }) {
  const tomorrow = getTomorrow();
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set(classes.map(c => c.id)));
  const [classDates, setClassDates] = useState<Record<string, string>>(() => Object.fromEntries(classes.map(c => [c.id, tomorrow])));
  const [statut, setStatut] = useState<"draft" | "published">("published");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" };
  function pillStyle(active: boolean): React.CSSProperties { return { flex: 1, padding: "8px 0", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700, border: active ? "2px solid #0A84FF" : "1.5px solid #E5E7EB", background: active ? "#EFF6FF" : "#FFF", color: active ? "#0A63BF" : "#374151" }; }
  function toggleClass(id: string) { setSelectedClasses(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function onSubmit() {
    if (selectedClasses.size === 0) return setErr("Sélectionne au moins une classe.");
    const classesWithDates = Array.from(selectedClasses).map(id => ({ classe_id: id, date: classDates[id] ?? tomorrow }));
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/evaluation-templates/${tpl.id}/distribute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classesWithDates, statut, school_id: ctx.schoolId }) });
      const data = await res.json() as { ok?: boolean; count?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      onDone(data.count ?? selectedClasses.size); onClose();
    } catch (e) { setErr(toNiceError(e)); } finally { setSaving(false); }
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "min(520px,96vw)", background: "#fff", borderRadius: 20, boxShadow: "0 24px 64px rgba(15,23,42,.28)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "linear-gradient(135deg,#7C3AED,#0A84FF)", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}><div style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>→ Distribuer &ldquo;{tpl.titre}&rdquo;</div><button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>×</button></div>
        <div style={{ padding: 20, display: "grid", gap: 14, overflowY: "auto" }}>
          {err && <div style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", color: "#991B1B", fontSize: 13 }}>{err}</div>}
          <div><div style={lbl}>Classes &amp; dates *</div><div style={{ display: "grid", gap: 6 }}>{classes.map(c => (<div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: selectedClasses.has(c.id) ? "#EDE9FE" : "#F9FAFB", border: selectedClasses.has(c.id) ? "1.5px solid #7C3AED" : "1px solid #E5E7EB" }}><input type="checkbox" checked={selectedClasses.has(c.id)} onChange={() => toggleClass(c.id)} style={{ width: 15, height: 15, cursor: "pointer", flexShrink: 0 }} /><span style={{ flex: 1, fontSize: 13, fontWeight: selectedClasses.has(c.id) ? 700 : 500, color: selectedClasses.has(c.id) ? "#5B21B6" : "#374151" }}>{c.name}</span><input type="date" value={classDates[c.id] ?? tomorrow} onChange={e => setClassDates(prev => ({ ...prev, [c.id]: e.target.value }))} disabled={!selectedClasses.has(c.id)} style={{ height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid #DDD6FE", fontSize: 13, background: selectedClasses.has(c.id) ? "#fff" : "#F3F4F6", color: selectedClasses.has(c.id) ? "#111827" : "#9CA3AF" }} /></div>))}</div></div>
          <div><div style={lbl}>Statut</div><div style={{ display: "flex", gap: 8 }}><button onClick={() => setStatut("draft")} style={pillStyle(statut === "draft")}>Brouillon</button><button onClick={() => setStatut("published")} style={pillStyle(statut === "published")}>✓ Publiée</button></div></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}><button onClick={onClose} style={{ height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Annuler</button><button onClick={onSubmit} disabled={saving || selectedClasses.size === 0} style={{ height: 42, padding: "0 20px", borderRadius: 9, border: "none", background: saving || selectedClasses.size === 0 ? "#9CA3AF" : "linear-gradient(135deg,#7C3AED,#0A84FF)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving || selectedClasses.size === 0 ? "not-allowed" : "pointer" }}>{saving ? "Création…" : `✓ Créer ${selectedClasses.size} évaluation${selectedClasses.size > 1 ? "s" : ""}`}</button></div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Créer un modèle ─────────────────────────────────────────────────────
function CreateTemplateModal({ ctx, onCreated, onClose }: { ctx: TeacherContext; onCreated: () => void; onClose: () => void }) {
  const [titre, setTitre] = useState("");
  const [type, setType] = useState<"formative" | "summative">("summative");
  const [selectedSubject, setSelectedSubject] = useState<SubjectDef>(SUBJECTS[0]);
  const [typeExercice, setTypeExercice] = useState(SUBJECTS[0].types[0].id);
  const [niveau, setNiveau] = useState(SUBJECTS[0].niveaux[0]);
  const [cotation, setCotation] = useState<CotationType>("nisbttb");
  const [maxPoints, setMaxPoints] = useState("20");
  const [instructions, setInstructions] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inp: React.CSSProperties = { height: 40, padding: "0 12px", borderRadius: 9, border: "1px solid #E5E7EB", fontSize: 14, width: "100%", boxSizing: "border-box" };
  const sel: React.CSSProperties = { ...inp, cursor: "pointer", background: "#FFF" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" };
  function pillStyle(active: boolean): React.CSSProperties { return { flex: 1, padding: "8px 0", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700, border: active ? "2px solid #7C3AED" : "1.5px solid #E5E7EB", background: active ? "#EDE9FE" : "#FFF", color: active ? "#5B21B6" : "#374151" }; }
  function handleSubjectChange(subj: SubjectDef) { setSelectedSubject(subj); setTypeExercice(subj.types[0].id); setNiveau(subj.niveaux[0]); }
  async function onSubmit() {
    if (!titre.trim()) return setErr("Titre obligatoire.");
    setSaving(true); setErr(null);
    try {
      let fichierPath: string | null = null; let fichierNom: string | null = null;
      if (pendingFile) {
        const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${ctx.teacherId}/template-${Date.now()}/${safeName}`;
        const { error: upErr } = await ctx.supabase.storage.from("evaluations").upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
        if (upErr) throw new Error(`Upload : ${upErr.message}`);
        fichierPath = path; fichierNom = pendingFile.name;
      }
      const res = await fetch("/api/evaluation-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titre: titre.trim(), type, matiere: selectedSubject.id, niveau, type_exercice: typeExercice, cotation_type: cotation, points_max: cotation === "points" ? (Number(maxPoints) || 20) : null, instructions: instructions.trim() || null, school_id: ctx.schoolId, fichier_path: fichierPath, fichier_nom: fichierNom }) });
      const data = await res.json() as { template?: unknown; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      onCreated(); onClose();
    } catch (e) { setErr(toNiceError(e)); } finally { setSaving(false); }
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "min(680px,96vw)", background: "#fff", borderRadius: 20, boxShadow: "0 24px 64px rgba(15,23,42,.28)", overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}><div style={{ color: "#fff", fontSize: 17, fontWeight: 900 }}>📚 Nouveau modèle</div><button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>×</button></div>
        <div style={{ padding: 22, display: "grid", gap: 12, overflowY: "auto" }}>
          {err && <div style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", color: "#991B1B", fontSize: 13 }}>{err}</div>}
          <div><div style={lbl}>Type d&apos;évaluation</div><div style={{ display: "flex", gap: 8 }}><button onClick={() => setType("summative")} style={pillStyle(type === "summative")}>🎓 Sommative</button><button onClick={() => setType("formative")} style={pillStyle(type === "formative")}>📊 Formative</button></div></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><div style={lbl}>Matière *</div><select style={sel} value={selectedSubject.id} onChange={e => { const s = SUBJECTS.find(s => s.id === e.target.value); if (s) handleSubjectChange(s); }}>{SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}</select></div>
            <div><div style={lbl}>Niveau</div><select style={sel} value={niveau} onChange={e => setNiveau(e.target.value)}>{selectedSubject.niveaux.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
          </div>
          <div><div style={lbl}>Titre / Thème *</div><input style={{ ...inp, height: 44 }} placeholder="Ex: QCM Flashcards 1" value={titre} onChange={e => setTitre(e.target.value)} autoFocus /></div>
          <div><div style={lbl}>Type d&apos;exercice</div><select style={sel} value={typeExercice} onChange={e => setTypeExercice(e.target.value)}>{selectedSubject.types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          <div><div style={lbl}>Système de cotation</div><div style={{ display: "flex", gap: 8 }}>{COTATION_OPTIONS.map(opt => (<button key={opt.id} onClick={() => setCotation(opt.id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 700, border: cotation === opt.id ? "2px solid #7C3AED" : "1.5px solid #E5E7EB", background: cotation === opt.id ? "#EDE9FE" : "#FFF", color: cotation === opt.id ? "#5B21B6" : "#374151", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><span>{opt.label}</span><span style={{ fontSize: 10, fontWeight: 500, color: "#9CA3AF" }}>{opt.desc}</span></button>))}</div></div>
          {cotation === "points" && (<div><div style={lbl}>Points max</div><input style={inp} value={maxPoints} onChange={e => setMaxPoints(e.target.value)} inputMode="numeric" placeholder="20" /></div>)}
          <div><div style={lbl}>Instructions / Consignes (optionnel)</div><textarea style={{ ...inp, height: 68, resize: "vertical", paddingTop: 9 }} placeholder="Ex: Vocabulaire de la famille…" value={instructions} onChange={e => setInstructions(e.target.value)} /></div>
          <div>
            <div style={lbl}>Fichier PDF / Word (optionnel)</div>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={e => setPendingFile(e.target.files?.[0] ?? null)} />
            {pendingFile ? (<div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, background: "#F0FDF4", border: "1px solid #BBF7D0" }}><span style={{ fontSize: 13, color: "#166534", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {pendingFile.name}</span><button onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} style={{ height: 26, width: 26, borderRadius: 7, border: "1px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", color: "#B91C1C", fontSize: 14, fontWeight: 700 }}>×</button></div>) : (<button onClick={() => fileInputRef.current?.click()} style={{ height: 40, width: "100%", borderRadius: 9, border: "1.5px dashed #DDD6FE", background: "#FAFAF9", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#7C3AED" }}>📎 Joindre un fichier</button>)}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}><button onClick={onClose} style={{ height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Annuler</button><button onClick={onSubmit} disabled={saving} style={{ height: 42, padding: "0 20px", borderRadius: 9, border: "none", background: saving ? "#9CA3AF" : "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Enregistrement…" : "💾 Créer le modèle"}</button></div>
        </div>
      </div>
    </div>
  );
}

// ── Carte modèle ──────────────────────────────────────────────────────────────
function TemplateCard({ tpl, classes, ctx, onDistributed, onDelete }: { tpl: EvaluationTemplate; classes: ClassGroup[]; ctx: TeacherContext; onDistributed: (count: number) => void; onDelete: () => void }) {
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const matiere = SUBJECTS.find(s => s.id === tpl.matiere);
  const abtn = (bg: string, color: string, border: string): React.CSSProperties => ({ height: 28, padding: "0 10px", borderRadius: 8, border: `1px solid ${border}`, background: bg, cursor: "pointer", fontSize: 11, fontWeight: 700, color, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 });
  async function handleDelete() { const res = await fetch(`/api/evaluation-templates/${tpl.id}`, { method: "DELETE" }); if (res.ok) onDelete(); }
  const fakeAssessment = { id: tpl.id, title: tpl.titre, type: tpl.type as "formative" | "summative", date: "", max_points: tpl.points_max, weight: null, status: "draft" as const, parent_visible: false, instructions: tpl.instructions, class_group_id: null, course_id: null, apprentissage_id: null, created_at: tpl.created_at, updated_at: tpl.created_at, fichier_path: tpl.fichier_path, fichier_nom: tpl.fichier_nom, cotation_type: tpl.cotation_type as "points" | "nisbttb", competences_evaluees: [], template_id: null };
  return (<>
    <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #DDD6FE", boxShadow: "0 1px 3px rgba(124,58,237,.08)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}><button onClick={() => setGridOpen(true)} style={abtn("#FFFBEB", "#92400E", "#FDE68A")}>📋 Grille</button><button onClick={() => setDistributeOpen(true)} style={abtn("#EDE9FE", "#5B21B6", "#DDD6FE")}>→ Distribuer</button><div style={{ marginLeft: "auto" }}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "#EDE9FE", color: "#5B21B6", border: "1px solid #DDD6FE" }}>📚 Modèle</span></div></div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "#EDE9FE", border: "1px solid #DDD6FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{matiere?.emoji ?? "📋"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}><span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "#EDE9FE", color: "#5B21B6", border: "1px solid #DDD6FE" }}>{tpl.type === "formative" ? "Formative" : "Sommative"}</span>{matiere && <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>{matiere.emoji} {matiere.label}</span>}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{tpl.titre}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{tpl.niveau && <span>📐 {tpl.niveau}</span>}{tpl.points_max && tpl.cotation_type === "points" && <span>🎯 /{tpl.points_max} pts</span>}{tpl.cotation_type === "nisbttb" && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>NI/I/S/B/TB</span>}</div>
          {tpl.instructions && <div style={{ marginTop: 6, fontSize: 12, color: "#6B7280", background: "#F9FAFB", borderRadius: 8, padding: "4px 8px", fontStyle: "italic" }}>{tpl.instructions}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
        {!confirmDelete ? (<button onClick={() => setConfirmDelete(true)} style={{ flex: 1, height: 32, borderRadius: 9, border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>🗑 Supprimer</button>) : (
          <div style={{ flex: 1, display: "flex", gap: 5 }}><button onClick={handleDelete} style={{ flex: 1, height: 32, borderRadius: 9, border: "1px solid #F87171", background: "#FEF2F2", cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#B91C1C" }}>✓ Confirmer suppression</button><button onClick={() => setConfirmDelete(false)} style={{ height: 32, width: 32, borderRadius: 9, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#6B7280" }}>×</button></div>
        )}
      </div>
    </div>
    {gridOpen && <GridEditorModal a={fakeAssessment} ctx={ctx} onClose={() => setGridOpen(false)} />}
    {distributeOpen && <DistributeModal tpl={tpl} classes={classes} ctx={ctx} onDone={count => onDistributed(count)} onClose={() => setDistributeOpen(false)} />}
  </>);
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function EvaluationsPage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [apprentissages, setApprentissages] = useState<Apprentissage[]>([]);
  const [rows, setRows] = useState<Assessment[]>([]);
  const [filterClassId, setFilterClassId] = useState<UUID | "">("");
  const [filterCourseId, setFilterCourseId] = useState<UUID | "">("");
  const [filterAssessmentId, setFilterAssessmentId] = useState<UUID | "">("");
  const [highlightedId, setHighlightedId] = useState<UUID | "">("");
  const [activeTab, setActiveTab] = useState<Tab>("toutes");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [showImport, setShowImport] = useState(false);
  const csvRef = useRef<HTMLInputElement | null>(null);
  const resCsvRef = useRef<HTMLInputElement | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvRows, setCsvRows] = useState<ParsedAssessmentCsvRow[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvSummary, setCsvSummary] = useState<AssessmentCsvImportSummary | null>(null);
  const [resCsvFileName, setResCsvFileName] = useState("");
  const [resCsvRows, setResCsvRows] = useState<ParsedAssessmentResultCsvRow[]>([]);
  const [resCsvImporting, setResCsvImporting] = useState(false);
  const [resCsvSummary, setResCsvSummary] = useState<AssessmentResultCsvImportSummary | null>(null);
  const [resTargetId, setResTargetId] = useState<UUID | "">("");

  const apprentissageNameById = useMemo(() => new Map(apprentissages.map(a => [a.id, a.name])), [apprentissages]);
  const stats = useMemo(() => ({ total: rows.length, formatives: rows.filter(r => r.type === "formative" && r.status !== "archived").length, sommatives: rows.filter(r => r.type === "summative" && r.status !== "archived").length, publiees: rows.filter(r => r.status === "published").length, archivees: rows.filter(r => r.status === "archived").length }), [rows]);
  const filteredRows = useMemo(() => { if (activeTab === "toutes") return rows.filter(r => r.status !== "archived"); if (activeTab === "archived") return rows.filter(r => r.status === "archived"); return rows.filter(r => r.type === activeTab && r.status !== "archived"); }, [rows, activeTab]);

  async function boot() {
    try {
      const c = await getTeacherContext(); setCtx(c);
      const [cls, crs, apps] = await Promise.all([listClassGroups(c), listCourses(c), listApprentissages(c)]);
      setClasses(cls); setCourses(crs); setApprentissages(apps);
      if (cls[0]?.id) setFilterClassId(cls[0].id);
      if (crs[0]?.id) setFilterCourseId(crs[0].id);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  async function refresh(c: TeacherContext) {
    try {
      setErrorMsg(null);
      const list = await listAssessments({ ctx: c, classGroupId: filterClassId || null, courseId: filterCourseId || null, apprentissageId: null, date: null, assessmentId: filterAssessmentId || null });
      setRows(list);
    } catch (e) { setErrorMsg(toNiceError(e)); }
  }

  async function loadTemplates() {
    try { const res = await fetch("/api/evaluation-templates"); const data = await res.json() as { templates?: EvaluationTemplate[]; error?: string }; if (res.ok) setTemplates(data.templates ?? []); } catch { /* silencieux */ }
  }

  useEffect(() => { boot(); void loadTemplates(); }, []);
  useEffect(() => { if (activeTab === "modeles") void loadTemplates(); }, [activeTab]);
  useEffect(() => { if (typeof window === "undefined") return; const p = new URLSearchParams(window.location.search); const qClass = p.get("class_group_id") ?? ""; const qAssessment = p.get("assessment_id") ?? ""; if (qAssessment) setFilterAssessmentId(qAssessment as UUID); if (qClass) setFilterClassId(qClass as UUID); }, []);
  useEffect(() => { if (ctx) refresh(ctx); }, [ctx, filterClassId, filterCourseId, filterAssessmentId]);
  useEffect(() => { if (!filterAssessmentId) return; const el = document.getElementById(`card-${filterAssessmentId}`); if (!el) return; el.scrollIntoView({ behavior: "smooth", block: "center" }); setHighlightedId(filterAssessmentId); const t = window.setTimeout(() => setHighlightedId(""), 2500); return () => window.clearTimeout(t); }, [rows, filterAssessmentId]);

  function flash(msg: string) { setInfoMsg(msg); setTimeout(() => setInfoMsg(null), 3000); }
  async function onToggleStatus(a: Assessment) { if (!ctx) return; try { const next: ContentStatus = a.status === "draft" ? "published" : "draft"; await updateAssessment({ ctx, assessmentId: a.id, patch: { status: next } }); await refresh(ctx); flash(`"${a.title}" → ${next === "published" ? "Publiée ✓" : "Brouillon"}`); } catch (e) { setErrorMsg(toNiceError(e)); } }
  async function onArchive(a: Assessment) { if (!ctx) return; try { await updateAssessment({ ctx, assessmentId: a.id, patch: { status: "archived" } }); await refresh(ctx); flash(`"${a.title}" archivée.`); } catch (e) { setErrorMsg(toNiceError(e)); } }
  async function onDelete(id: UUID) { if (!ctx) return; try { await deleteAssessment({ ctx, assessmentId: id }); await refresh(ctx); } catch (e) { setErrorMsg(toNiceError(e)); } }
  async function onSelectCsv(file: File | null) { setCsvRows([]); setCsvSummary(null); setCsvFileName(file?.name ?? ""); if (!file) return; try { setCsvRows(parseAssessmentsCsv(await file.text())); } catch (e) { setErrorMsg(toNiceError(e)); } }
  async function onImportCsv() { if (!ctx || !csvRows.length) return; try { setCsvImporting(true); const s = await importAssessmentsCsv({ ctx, rows: csvRows, classes, courses, apprentissages }); setCsvSummary(s); await refresh(ctx); flash(`Import : ${s.created} créé(s).`); } catch (e) { setErrorMsg(toNiceError(e)); } finally { setCsvImporting(false); } }
  async function onSelectResCsv(file: File | null) { setResCsvRows([]); setResCsvSummary(null); setResCsvFileName(file?.name ?? ""); if (!file) return; try { setResCsvRows(parseAssessmentResultsCsv(await file.text())); } catch (e) { setErrorMsg(toNiceError(e)); } }
  async function onImportResCsv() { if (!ctx || !resCsvRows.length) return; try { setResCsvImporting(true); const s = await importAssessmentResultsCsv({ ctx, rows: resCsvRows, classes, targetAssessmentId: resTargetId || null }); setResCsvSummary(s); flash(`Import résultats : ${s.upserted} ligne(s).`); } catch (e) { setErrorMsg(toNiceError(e)); } finally { setResCsvImporting(false); } }

  const selStyle: React.CSSProperties = { height: 38, padding: "0 11px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#FFF", fontSize: 13, cursor: "pointer" };
  const btnStyle: React.CSSProperties = { height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #E5E7EB", background: "#FFF", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 16, padding: "0 4px 32px" }}>
      {errorMsg && (<div style={{ padding: "11px 16px", borderRadius: 11, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", color: "#991B1B", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>{errorMsg} <button style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", fontWeight: 900 }} onClick={() => setErrorMsg(null)}>×</button></div>)}
      {infoMsg && (<div style={{ padding: "11px 16px", borderRadius: 11, background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.25)", color: "#166534", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>{infoMsg} <button style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: 900 }} onClick={() => setInfoMsg(null)}>×</button></div>)}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {[{ label: "Total", value: stats.total, color: "#111827", bg: "#F9FAFB" }, { label: "Formatives", value: stats.formatives, color: "#1D4ED8", bg: "#EFF6FF" }, { label: "Sommatives", value: stats.sommatives, color: "#6D28D9", bg: "#F5F3FF" }, { label: "Publiées", value: stats.publiees, color: "#166534", bg: "#F0FDF4" }, { label: "Archivées", value: stats.archivees, color: "#6B7280", bg: "#F3F4F6" }].map(s => (<div key={s.label} style={{ borderRadius: 12, padding: "12px 14px", background: s.bg, border: "1px solid #E5E7EB" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{s.label}</div><div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div></div>))}
      </div>
      <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB" }}>{TAB_CONFIG.map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab.id ? 800 : 500, color: activeTab === tab.id ? "#111827" : "#9CA3AF", borderBottom: activeTab === tab.id ? "2px solid #0A84FF" : "2px solid transparent", transition: "all .15s" }}>{tab.emoji} {tab.label}</button>))}</div>
        <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select style={selStyle} value={filterClassId} onChange={e => setFilterClassId(e.target.value as UUID)}><option value="">Toutes les classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select style={selStyle} value={filterCourseId} onChange={e => setFilterCourseId(e.target.value as UUID)}><option value="">Tous les cours</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div style={{ flex: 1 }} />

          {activeTab === "modeles" ? (<button onClick={() => setShowCreateTemplateModal(true)} disabled={!ctx} style={{ height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: ctx ? "pointer" : "not-allowed" }}>+ Nouveau modèle</button>) : (<button onClick={() => setShowCreateModal(true)} disabled={!ctx} style={{ height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#FF3B30,#0A84FF)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: ctx ? "pointer" : "not-allowed" }}>+ Nouvelle évaluation</button>)}
        </div>

      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {activeTab === "modeles" ? (templates.length === 0 ? (<div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #DDD6FE", padding: "40px 24px", textAlign: "center", color: "#6B7280" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📚</div><div style={{ fontWeight: 700, fontSize: 15 }}>Aucun modèle</div></div>) : (templates.map(tpl => (<TemplateCard key={tpl.id} tpl={tpl} classes={classes} ctx={ctx!} onDistributed={count => { flash(`${count} évaluation${count > 1 ? "s" : ""} créée${count > 1 ? "s" : ""} ✅`); if (ctx) void refresh(ctx); }} onDelete={() => { setTemplates(prev => prev.filter(t => t.id !== tpl.id)); flash("Modèle supprimé."); }} />)))) : filteredRows.length === 0 ? (<div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", padding: "40px 24px", textAlign: "center", color: "#6B7280" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div><div style={{ fontWeight: 700, fontSize: 15 }}>{activeTab === "archived" ? "Aucune évaluation archivée" : "Aucune évaluation"}</div></div>) : (filteredRows.map(a => (<AssessmentCard key={a.id} a={a} apprentissageNameById={apprentissageNameById} highlighted={a.id === highlightedId} onToggleStatus={onToggleStatus} onArchive={onArchive} onDelete={onDelete} onRefresh={() => ctx && refresh(ctx)} ctx={ctx!} />)))}
      </div>
      {showCreateModal && ctx && (<CreateModal ctx={ctx} classes={classes} courses={courses} apprentissages={apprentissages} onCreated={() => { setFilterClassId(""); setFilterCourseId(""); setShowCreateModal(false); }} onClose={() => setShowCreateModal(false)} />)}
      {showCreateTemplateModal && ctx && (<CreateTemplateModal ctx={ctx} onCreated={() => { setShowCreateTemplateModal(false); void loadTemplates(); }} onClose={() => setShowCreateTemplateModal(false)} />)}
    </div>
  );
}
