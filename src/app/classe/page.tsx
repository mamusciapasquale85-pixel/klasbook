"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  getTeacherContext, listClassGroups, upsertClassGroup, deleteClassGroup,
  addStudentAndEnroll, removeStudentFromClass,
  type TeacherContext, type ClassGroup,
} from "@/app/resultats/resultats";

type Niveaux = { TM: number; M: number; NM: number; NI: number };
type Eleve = {
  id: string; prenom: string; nom: string;
  total_resultats: number; niveaux: Niveaux;
  score_maitrise: number | null; dernier_niveau: string | null;
  en_difficulte: boolean;
};

const NIVEAU_CONFIG = {
  TM: { label: "TM", bg: "#DCFCE7", text: "#166534", border: "#BBF7D0" },
  M:  { label: "M",  bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  NM: { label: "NM", bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  NI: { label: "NI", bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
};

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>;
  const color = score >= 75 ? "#16A34A" : score >= 50 ? "#1D4ED8" : score >= 25 ? "#C2410C" : "#B91C1C";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 3, transition: "width .4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32 }}>{score}%</span>
    </div>
  );
}

function NiveauxBadges({ niveaux }: { niveaux: Niveaux }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {(["TM", "M", "NM", "NI"] as const).map(n => {
        if (!niveaux[n]) return null;
        const c = NIVEAU_CONFIG[n];
        return (
          <span key={n} style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
            {niveaux[n]}{n}
          </span>
        );
      })}
    </div>
  );
}

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, minWidth: 360, maxWidth: 520, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function AddClassModal({ onClose, onSave, saving }: { onClose: () => void; onSave: (name: string, grade: number) => void; saving: boolean }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(1);
  return (
    <ModalOverlay>
      <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 800 }}>➕ Nouvelle classe</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>Nom de la classe</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="ex : 5TQ1, 3GT2…"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>Année / niveau</label>
          <input type="number" min={1} max={7} value={grade} onChange={e => setGrade(Number(e.target.value))}
            style={{ width: 80, padding: "9px 12px", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Annuler</button>
        <button onClick={() => onSave(name, grade)} disabled={!name.trim() || saving}
          style={{ padding: "8px 20px", borderRadius: 8, background: "#111827", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: !name.trim() || saving ? "not-allowed" : "pointer", opacity: !name.trim() || saving ? 0.6 : 1 }}>
          {saving ? "Création…" : "Créer la classe"}
        </button>
      </div>
    </ModalOverlay>
  );
}

function AddStudentModal({ className, onClose, onSave, saving }: { className: string; onClose: () => void; onSave: (first: string, last: string) => void; saving: boolean }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  return (
    <ModalOverlay>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>➕ Ajouter un élève</h3>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 18px" }}>dans {className}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>Prénom</label>
          <input autoFocus value={first} onChange={e => setFirst(e.target.value)} placeholder="Prénom"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>Nom</label>
          <input value={last} onChange={e => setLast(e.target.value)} placeholder="Nom de famille"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Annuler</button>
        <button onClick={() => onSave(first, last)} disabled={!first.trim() || !last.trim() || saving}
          style={{ padding: "8px 20px", borderRadius: 8, background: "#111827", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: !first.trim() || !last.trim() || saving ? "not-allowed" : "pointer", opacity: !first.trim() || !last.trim() || saving ? 0.6 : 1 }}>
          {saving ? "Ajout…" : "Ajouter"}
        </button>
      </div>
    </ModalOverlay>
  );
}

type ImportPreviewRow = { prenom: string; nom: string; email?: string; parent_email?: string; valid: boolean; error?: string };

function downloadCSVTemplate() {
  const csv = "prenom;nom;email;email_parent\nJean;Dupont;jean.dupont@ecole.be;parent.dupont@gmail.com\nMarie;Martin;marie.martin@ecole.be;";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "modele_eleves.csv"; a.click();
  URL.revokeObjectURL(url);
}

function ImportElevesModal({ className, onClose, onImport, saving }: {
  className: string;
  onClose: () => void;
  onImport: (rows: { prenom: string; nom: string; email?: string; parent_email?: string }[]) => Promise<void>;
  saving: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  async function parseXLSX(file: File): Promise<ImportPreviewRow[]> {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (data.length === 0) return [];
    const headers = (data[0] as string[]).map(h => String(h).trim().toLowerCase());
    const prenomIdx = headers.findIndex(h => h.includes("prénom") || h.includes("prenom") || h === "first_name" || h === "firstname");
    const nomIdx = headers.findIndex(h => h === "nom" || h === "last_name" || h === "lastname" || h.includes("famille"));
    const emailIdx = headers.findIndex(h => h === "email" || h === "mail" || h === "email_eleve" || h === "email élève");
    const parentEmailIdx = headers.findIndex(h => h.includes("parent") || h === "email_parent" || h === "email parent" || h === "mail_parent");
    const usePrenomIdx = prenomIdx >= 0 ? prenomIdx : 0;
    const useNomIdx = nomIdx >= 0 ? nomIdx : 1;
    const dataRows = prenomIdx >= 0 ? data.slice(1) : data;
    return dataRows
      .map(row => {
        const prenom = String(row[usePrenomIdx] ?? "").trim();
        const nom = String(row[useNomIdx] ?? "").trim();
        const email = emailIdx >= 0 ? String(row[emailIdx] ?? "").trim() || undefined : undefined;
        const parent_email = parentEmailIdx >= 0 ? String(row[parentEmailIdx] ?? "").trim() || undefined : undefined;
        const valid = prenom.length > 0 && nom.length > 0;
        return { prenom, nom, email, parent_email, valid, error: !valid ? "Prénom ou nom manquant" : undefined };
      })
      .filter(r => r.prenom || r.nom);
  }

  function parseCSV(text: string): ImportPreviewRow[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];

    // Détecte le séparateur
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

    const prenomIdx = headers.findIndex(h => h.includes("prénom") || h.includes("prenom") || h === "first_name" || h === "firstname");
    const nomIdx = headers.findIndex(h => h === "nom" || h === "last_name" || h === "lastname" || h.includes("famille"));
    const emailIdx = headers.findIndex(h => h === "email" || h === "mail" || h === "email_eleve" || h === "email élève");
    const parentEmailIdx = headers.findIndex(h => h.includes("parent") || h === "email_parent" || h === "email parent" || h === "mail_parent");

    const usePrenomIdx = prenomIdx >= 0 ? prenomIdx : 0;
    const useNomIdx = nomIdx >= 0 ? nomIdx : 1;

    const dataLines = prenomIdx >= 0 ? lines.slice(1) : lines;

    return dataLines.map(line => {
      const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));
      const prenom = cols[usePrenomIdx] ?? "";
      const nom = cols[useNomIdx] ?? "";
      const email = emailIdx >= 0 ? cols[emailIdx]?.trim() || undefined : undefined;
      const parent_email = parentEmailIdx >= 0 ? cols[parentEmailIdx]?.trim() || undefined : undefined;
      const valid = prenom.length > 0 && nom.length > 0;
      return { prenom, nom, email, parent_email, valid, error: !valid ? "Prénom ou nom manquant" : undefined };
    }).filter(r => r.prenom || r.nom);
  }

  async function onFileChange(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setPreview([]);
    try {
      let rows: ImportPreviewRow[];
      const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      if (isXlsx) {
        rows = await parseXLSX(file);
      } else {
        const text = await file.text();
        rows = parseCSV(text);
      }
      if (rows.length === 0) throw new Error("Aucune ligne détectée.");
      setPreview(rows);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Erreur de lecture");
    }
  }

  const validRows = preview.filter(r => r.valid);

  async function handleImport() {
    if (validRows.length === 0) return;
    try {
      await onImport(validRows.map(r => ({ prenom: r.prenom, nom: r.nom, email: r.email, parent_email: r.parent_email })));
      setImportResult(`✅ ${validRows.length} élève${validRows.length > 1 ? "s" : ""} importé${validRows.length > 1 ? "s" : ""} avec succès.`);
      setImportDone(true);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Erreur import");
    }
  }

  return (
    <ModalOverlay>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>📥 Importer une liste d'élèves</h3>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>dans {className}</p>

      {!importDone ? (
        <>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "#475569" }}>
            <b>Formats acceptés :</b> CSV (<code>.csv</code>) ou Excel (<code>.xlsx</code>).<br />
            Colonnes : <code>prenom</code>, <code>nom</code>, <code>email</code> (optionnel), <code>email_parent</code> (optionnel).<br />
            Pour CSV : séparateur <code>;</code> ou <code>,</code>. La première ligne peut être un en-tête.
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📂 Choisir un fichier CSV / Excel
            </button>
            <button onClick={downloadCSVTemplate}
              style={{ padding: "9px 14px", borderRadius: 9, border: "1.5px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📋 Modèle CSV
            </button>
            {fileName && <span style={{ fontSize: 13, color: "#64748b", alignSelf: "center" }}>{fileName}</span>}
          </div>

          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv" style={{ display: "none" }}
            onChange={e => void onFileChange(e.target.files?.[0] ?? null)} />

          {parseError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#b91c1c", marginBottom: 12 }}>
              ⚠️ {parseError}
            </div>
          )}

          {preview.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                Aperçu — {validRows.length} élève{validRows.length > 1 ? "s" : ""} valide{validRows.length > 1 ? "s" : ""} sur {preview.length}
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 14 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Prénom</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Nom</th>
                      {preview.some(r => r.email) && <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Email élève</th>}
                      {preview.some(r => r.parent_email) && <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Email parent</th>}
                      <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} style={{ background: r.valid ? "transparent" : "#fef2f2" }}>
                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #f3f4f6" }}>{r.prenom || "—"}</td>
                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #f3f4f6" }}>{r.nom || "—"}</td>
                        {preview.some(p => p.email) && <td style={{ padding: "7px 12px", borderBottom: "1px solid #f3f4f6", fontSize: 11, color: "#64748b" }}>{r.email || "—"}</td>}
                        {preview.some(p => p.parent_email) && <td style={{ padding: "7px 12px", borderBottom: "1px solid #f3f4f6", fontSize: 11, color: "#64748b" }}>{r.parent_email || "—"}</td>}
                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #f3f4f6", textAlign: "center" }}>
                          {r.valid ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✓</span> : <span style={{ color: "#b91c1c", fontSize: 11 }}>{r.error}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Annuler</button>
            <button onClick={() => void handleImport()} disabled={validRows.length === 0 || saving}
              style={{ padding: "8px 20px", borderRadius: 8, background: validRows.length === 0 || saving ? "#e2e8f0" : "#111827", color: validRows.length === 0 || saving ? "#94a3b8" : "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: validRows.length === 0 || saving ? "not-allowed" : "pointer" }}>
              {saving ? "Import en cours…" : `Importer ${validRows.length} élève${validRows.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#16a34a", marginBottom: 20 }}>{importResult}</div>
          <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 10, background: "#111827", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      )}
    </ModalOverlay>
  );
}

export default function ClassePage() {
  const [ctx, setCtx] = useState<TeacherContext | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [activeClass, setActiveClass] = useState<string>("");
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "NI" | "NM" | "difficulte">("tous");
  const [search, setSearch] = useState("");
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showImportEleves, setShowImportEleves] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    getTeacherContext()
      .then(async c => {
        setCtx(c);
        const cls = await listClassGroups(c);
        setClasses(cls);
        if (cls.length > 0) setActiveClass(cls[0].id);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Erreur d'initialisation"));
  }, []);

  const loadEleves = useCallback(async (classGroupId: string) => {
    setLoading(true); setError(null); setEleves([]);
    try {
      const res = await fetch(`/api/classe?classGroupId=${classGroupId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEleves(data.eleves ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (activeClass) loadEleves(activeClass); }, [activeClass, loadEleves]);

  async function handleAddClass(name: string, grade: number) {
    if (!ctx) return;
    setSaving(true); setActionError(null);
    try {
      await upsertClassGroup(ctx, { name, grade_level: grade });
      const cls = await listClassGroups(ctx);
      setClasses(cls);
      const newCls = cls.find(c => c.name === name);
      if (newCls) setActiveClass(newCls.id);
      setShowAddClass(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  }

  async function handleDeleteClass() {
    if (!ctx || !activeClass) return;
    const cls = classes.find(c => c.id === activeClass);
    if (!window.confirm(`Supprimer la classe "${cls?.name}" ? Cette action est irréversible.`)) return;
    setSaving(true); setActionError(null);
    try {
      await deleteClassGroup(ctx, activeClass);
      const newCls = await listClassGroups(ctx);
      setClasses(newCls);
      setActiveClass(newCls[0]?.id ?? "");
      setEleves([]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Impossible de supprimer (des évaluations ou élèves y sont liés ?)");
    } finally { setSaving(false); }
  }

  async function handleAddStudent(first: string, last: string) {
    if (!ctx || !activeClass) return;
    setSaving(true); setActionError(null);
    try {
      await addStudentAndEnroll(ctx, { classGroupId: activeClass, first_name: first, last_name: last });
      setShowAddStudent(false);
      loadEleves(activeClass);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  }

  async function handleImportEleves(rows: { prenom: string; nom: string; email?: string; parent_email?: string }[]) {
    if (!ctx || !activeClass) throw new Error("Contexte manquant");
    setSaving(true);
    try {
      for (const row of rows) {
        const studentId = await addStudentAndEnroll(ctx, { classGroupId: activeClass, first_name: row.prenom, last_name: row.nom });
        if (row.email || row.parent_email) {
          await fetch(`/api/eleves/${studentId}/contacts`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: row.email ?? null, parent_email: row.parent_email ?? null }),
          });
        }
      }
      loadEleves(activeClass);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveStudent(studentId: string, name: string) {
    if (!ctx || !activeClass) return;
    if (!window.confirm(`Retirer "${name}" de cette classe ?`)) return;
    setActionError(null);
    try {
      await removeStudentFromClass(ctx, activeClass, studentId);
      loadEleves(activeClass);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur");
    }
  }

  const filtered = eleves.filter(e => {
    const matchSearch = search === "" || `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase());
    const matchFiltre =
      filtre === "tous" ? true :
      filtre === "NI" ? e.niveaux.NI > 0 :
      filtre === "NM" ? e.niveaux.NM > 0 :
      filtre === "difficulte" ? e.en_difficulte : true;
    return matchSearch && matchFiltre;
  });

  const activeClassData = classes.find(c => c.id === activeClass);
  const nbNI = eleves.filter(e => e.niveaux.NI > 0).length;
  const nbNM = eleves.filter(e => e.niveaux.NM > 0).length;
  const avgScore = eleves.filter(e => e.score_maitrise !== null).length > 0
    ? Math.round(eleves.filter(e => e.score_maitrise !== null).reduce((s, e) => s + (e.score_maitrise ?? 0), 0) / eleves.filter(e => e.score_maitrise !== null).length)
    : null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 4px 32px" }}>

      {/* ── Sélecteur classes + actions ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {classes.map(c => (
          <button key={c.id} onClick={() => setActiveClass(c.id)}
            style={{ padding: "8px 18px", borderRadius: 10, border: activeClass === c.id ? "2px solid #111827" : "1.5px solid #E5E7EB", background: activeClass === c.id ? "#111827" : "#FFF", color: activeClass === c.id ? "#FFF" : "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {c.name}
          </button>
        ))}
        <button onClick={() => setShowAddClass(true)}
          style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px dashed #CBD5E1", background: "#F8FAFC", color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          ＋ Classe
        </button>
        {activeClass && ctx && (
          <button onClick={handleDeleteClass} disabled={saving}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid #FECACA", background: "#FFF5F5", color: "#B91C1C", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            title="Supprimer cette classe">
            🗑
          </button>
        )}
        {/* ── Bouton importer liste ── */}
        {activeClass && ctx && (
          <button onClick={() => setShowImportEleves(true)}
            style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            📥 Importer
          </button>
        )}
        {/* ── Bouton exporter CSV ── */}
        {activeClass && eleves.length > 0 && (
          <button onClick={() => {
            const activeClassData = classes.find(c => c.id === activeClass);
            const rows = [["prenom", "nom", "email", "email_parent"]];
            eleves.forEach(e => rows.push([e.prenom, e.nom, "", ""]));
            const csv = rows.map(r => r.join(";")).join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${activeClassData?.name ?? "classe"}_eleves.csv`; a.click();
            URL.revokeObjectURL(url);
          }}
            style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #D1FAE5", background: "#ECFDF5", color: "#065F46", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            📤 Exporter CSV
          </button>
        )}
      </div>

      {actionError && (
        <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {/* ── Stats ── */}
      {eleves.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Élèves", value: eleves.length, color: "#111827", bg: "#F9FAFB" },
            { label: "Score moyen", value: avgScore !== null ? `${avgScore}%` : "—", color: "#1D4ED8", bg: "#EFF6FF" },
            { label: "Avec NM", value: nbNM, color: "#C2410C", bg: "#FFF7ED" },
            { label: "Avec NI 🚨", value: nbNI, color: "#B91C1C", bg: "#FEF2F2" },
          ].map(s => (
            <div key={s.label} style={{ borderRadius: 12, padding: "12px 14px", background: s.bg, border: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtres + recherche + ajout élève ── */}
      <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", marginBottom: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB" }}>
          {[
            { id: "tous" as const, label: "Tous", count: eleves.length },
            { id: "NI" as const, label: "🚨 NI", count: nbNI },
            { id: "NM" as const, label: "⚠️ NM", count: nbNM },
            { id: "difficulte" as const, label: "En difficulté", count: eleves.filter(e => e.en_difficulte).length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setFiltre(tab.id)}
              style={{ flex: 1, padding: "11px 8px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: filtre === tab.id ? 800 : 500, color: filtre === tab.id ? "#111827" : "#9CA3AF", borderBottom: filtre === tab.id ? "2px solid #111827" : "2px solid transparent" }}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <div style={{ padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Rechercher dans ${activeClassData?.name ?? "la classe"}…`}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid #E5E7EB", fontSize: 13, outline: "none" }} />
          {activeClass && ctx && (
            <button onClick={() => setShowAddStudent(true)}
              style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#111827", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              ＋ Élève
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding: 16, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}><div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>Chargement…</div>}

      {!loading && activeClass && eleves.length === 0 && !error && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 14, marginBottom: 16 }}>Aucun élève dans cette classe.</div>
          {ctx && (
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowAddStudent(true)}
                style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "#111827", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                ＋ Ajouter un élève
              </button>
              <button onClick={() => setShowImportEleves(true)}
                style={{ padding: "9px 20px", borderRadius: 9, border: "1.5px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                📥 Importer liste
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 36px", gap: 16, padding: "10px 18px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            {["Élève", "Résultats", "Score de maîtrise", "Niveaux", ""].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</div>
            ))}
          </div>
          {filtered.map((e, i) => (
            <div key={e.id} style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 36px",
              gap: 16, padding: "12px 18px", alignItems: "center",
              background: e.niveaux.NI > 0 ? "#FFF5F5" : i % 2 === 0 ? "#FFF" : "#FAFAFA",
              borderBottom: "1px solid #F3F4F6",
            }}>
              <Link href={`/eleves/${e.id}`} style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: e.niveaux.NI > 0 ? "#FEE2E2" : e.niveaux.NM > 0 ? "#FEF3C7" : "#EFF6FF",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800,
                    color: e.niveaux.NI > 0 ? "#B91C1C" : e.niveaux.NM > 0 ? "#92400E" : "#1D4ED8",
                  }}>
                    {e.prenom[0]}{e.nom[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{e.prenom} {e.nom}</div>
                    {e.niveaux.NI > 0 && <div style={{ fontSize: 11, color: "#B91C1C", fontWeight: 600 }}>🚨 Besoin de remédiation</div>}
                  </div>
                </div>
              </Link>
              <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>
                {e.total_resultats > 0 ? `${e.total_resultats} résultat${e.total_resultats > 1 ? "s" : ""}` : <span style={{ color: "#D1D5DB" }}>Aucun</span>}
              </div>
              <ScoreBar score={e.score_maitrise} />
              {e.total_resultats > 0 ? <NiveauxBadges niveaux={e.niveaux} /> : <span style={{ fontSize: 12, color: "#D1D5DB" }}>—</span>}
              <button onClick={() => handleRemoveStudent(e.id, `${e.prenom} ${e.nom}`)} title="Retirer de la classe"
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #FECACA", background: "#FFF5F5", color: "#B91C1C", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#9CA3AF" }}>
          {filtered.length} élève{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
          {filtre !== "tous" || search ? ` sur ${eleves.length} dans ${activeClassData?.name}` : ` dans ${activeClassData?.name}`}
        </div>
      )}

      {showAddClass && <AddClassModal onClose={() => setShowAddClass(false)} onSave={handleAddClass} saving={saving} />}
      {showAddStudent && activeClassData && <AddStudentModal className={activeClassData.name} onClose={() => setShowAddStudent(false)} onSave={handleAddStudent} saving={saving} />}
      {showImportEleves && activeClassData && (
        <ImportElevesModal
          className={activeClassData.name}
          onClose={() => { setShowImportEleves(false); }}
          onImport={handleImportEleves}
          saving={saving}
        />
      )}
    </div>
  );
}
