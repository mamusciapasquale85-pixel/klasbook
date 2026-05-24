"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Design tokens ────────────────────────────────────────────────────────────
const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const BG = "#0f172a";
const CARD = { background: "#1e293b", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" } as React.CSSProperties;

const LEVEL_COLORS: Record<string, string> = { TB: "#16a34a", B: "#86efac", S: "#fbbf24", I: "#fb923c", NI: "#ef4444" };
const LEVEL_TEXT: Record<string, string>   = { TB: "#fff", B: "#14532d", S: "#78350f", I: "#7c2d12", NI: "#fff" };

// ─── Types ────────────────────────────────────────────────────────────────────
type Student = { id: string; first_name: string; last_name: string };
type ClassGroup = { id: string; name: string };
type Assessment = { id: string; title: string; date: string; type: string; max_points: number | null; class_group_id: string | null };
type Resultat = { assessment_id: string; value: number | null; level: string | null };
type Apprentissage = { id: string; name: string; order_index: number };
type Remarque = { id: string; date: string; note: string; teacher_name?: string };
type AgendaItem = { id: string; date: string; type: "lesson" | "homework" | "test"; title: string; details: string | null };

type StudentData = {
  student: Student;
  classes: ClassGroup[];
  assessments: Assessment[];
  resultats: Resultat[];
  apprentissages: Apprentissage[];
  remarques: Remarque[];
  agendaItems: AgendaItem[];
};

// ─── Level badge ──────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>—</span>;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: LEVEL_COLORS[level] ?? "#64748b", color: LEVEL_TEXT[level] ?? "#fff", fontSize: 11, fontWeight: 800 }}>
      {level}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ParentPortal() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<StudentData[]>([]);
  const [activeChild, setActiveChild] = useState(0);
  const [activeTab, setActiveTab] = useState<"resultats" | "remarques" | "agenda">("resultats");

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      // 1. Enfants liés
      const { data: links, error: linksErr } = await supabase
        .from("parent_links")
        .select("student_id, school_id")
        .eq("parent_user_id", user.id);
      if (linksErr) throw linksErr;
      if (!links || links.length === 0) { setChildren([]); setLoading(false); return; }

      const studentIds = links.map(l => l.student_id);
      const schoolId = links[0].school_id;

      // 2. Infos des élèves
      const { data: studs } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .in("id", studentIds);

      // 3. Classes de chaque élève
      const { data: enrollments } = await supabase
        .from("student_enrollments")
        .select("student_id, class_groups(id, name)")
        .in("student_id", studentIds);

      // 4. Apprentissages de l'école
      const { data: apprentissages } = await supabase
        .from("apprentissages")
        .select("id, name, order_index")
        .eq("school_id", schoolId)
        .order("order_index");

      const result: StudentData[] = [];

      for (const stud of (studs ?? [])) {
        // Classes
        const studEnrollments = (enrollments ?? []).filter(e => e.student_id === stud.id);
        const classes = studEnrollments.map((e: any) => e.class_groups).filter(Boolean);
        const classIds = classes.map((c: any) => c.id);

        // Évaluations de ses classes
        let assessments: Assessment[] = [];
        if (classIds.length > 0) {
          const { data: ass } = await supabase
            .from("assessments")
            .select("id, title, date, type, max_points, class_group_id")
            .in("class_group_id", classIds)
            .eq("school_id", schoolId)
            .order("date", { ascending: false });
          assessments = (ass ?? []) as Assessment[];
        }

        // Résultats
        const assIds = assessments.map(a => a.id);
        let resultats: Resultat[] = [];
        if (assIds.length > 0) {
          const { data: res } = await supabase
            .from("resultats")
            .select("assessment_id, value, level")
            .eq("student_id", stud.id)
            .in("assessment_id", assIds);
          resultats = (res ?? []) as Resultat[];
        }

        // Remarques disciplinaires
        let remarques: Remarque[] = [];
        try {
          const { data: rem } = await supabase
            .from("remarques")
            .select("id, date:created_at, note:text")
            .eq("student_id", stud.id)
            .order("created_at", { ascending: false })
            .limit(20);
          remarques = (rem ?? []) as Remarque[];
        } catch { /* table peut ne pas exister */ }

        // Agenda — éléments à venir pour les classes de l'élève
        let agendaItems: AgendaItem[] = [];
        if (classIds.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const { data: ag } = await supabase
            .from("agenda_items")
            .select("id, date, type, title, details")
            .in("class_group_id", classIds)
            .gte("date", today)
            .order("date", { ascending: true })
            .limit(30);
          agendaItems = (ag ?? []) as AgendaItem[];
        }

        result.push({
          student: stud,
          classes,
          assessments,
          resultats,
          apprentissages: (apprentissages ?? []) as Apprentissage[],
          remarques,
          agendaItems,
        });
      }

      setChildren(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function getResultat(childData: StudentData, assessmentId: string) {
    return childData.resultats.find(r => r.assessment_id === assessmentId) ?? null;
  }

  function scoreLabel(r: Resultat | null, maxPoints: number | null): string {
    if (!r) return "—";
    if (r.level) return r.level;
    if (r.value !== null && maxPoints) return `${r.value}/${maxPoints}`;
    if (r.value !== null) return `${r.value}`;
    return "—";
  }

  function globalLevel(childData: StudentData): string | null {
    const levels = childData.resultats.map(r => r.level).filter(Boolean) as string[];
    if (!levels.length) return null;
    const order = ["NI","I","S","B","TB"];
    const avg = levels.reduce((s, l) => s + order.indexOf(l), 0) / levels.length;
    return order[Math.round(avg)] ?? null;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>Chargement…</span>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ color: "#fca5a5" }}>{error}</div>
    </div>
  );

  if (children.length === 0) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 48 }}>👨‍👩‍👧</div>
      <div style={{ color: "#f8fafc", fontSize: 20, fontWeight: 700 }}>Aucun enfant lié à ce compte</div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Contactez l'école pour lier votre compte à votre enfant.</div>
    </div>
  );

  const child = children[activeChild];
  const gl = globalLevel(child);

  // Group assessments by type
  const evaluations = child.assessments.filter(a => a.type === "summative");
  const devoirs     = child.assessments.filter(a => a.type !== "summative");

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#f8fafc" }}>
      {/* Header */}
      <div style={{ background: GRADIENT, padding: "28px 32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 28 }}>👨‍👩‍👧</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>Portail Parents</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Klasbook · Suivi scolaire</p>
          </div>
        </div>

        {/* Child tabs */}
        {children.length > 1 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {children.map((c, i) => (
              <button key={c.student.id} onClick={() => { setActiveChild(i); setActiveTab("resultats"); }}
                style={{ background: i === activeChild ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)", border: "none", borderRadius: 12, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: i === activeChild ? "#0f172a" : "#fff", cursor: "pointer" }}>
                {c.student.first_name} {c.student.last_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "28px 32px" }}>
        {/* Student card */}
        <div style={{ ...CARD, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(10,132,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#60a5fa", flexShrink: 0 }}>
            {child.student.first_name[0]}{child.student.last_name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{child.student.first_name} {child.student.last_name.toUpperCase()}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
              {child.classes.map((c: any) => c.name).join(", ") || "Classe non assignée"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#60a5fa" }}>{child.assessments.length}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Évaluations</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#34d399" }}>{child.resultats.filter(r => r.level || r.value !== null).length}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Résultats</div>
            </div>
            {gl && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, padding: "2px 10px", borderRadius: 8, background: LEVEL_COLORS[gl] ?? "#64748b", color: LEVEL_TEXT[gl] ?? "#fff", display: "inline-block" }}>{gl}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Niveau global</div>
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {(["resultats", "agenda", "remarques"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: activeTab === tab ? "rgba(10,132,255,0.9)" : "#1e293b", border: `1px solid ${activeTab === tab ? "#0A84FF" : "rgba(255,255,255,0.12)"}`, borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
              {tab === "resultats" ? "📊 Résultats" : tab === "agenda" ? `📅 Agenda${child.agendaItems.length > 0 ? ` (${child.agendaItems.length})` : ""}` : `⚠️ Remarques${child.remarques.length > 0 ? ` (${child.remarques.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* Results tab */}
        {activeTab === "resultats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {child.assessments.length === 0 ? (
              <div style={{ ...CARD, padding: 48, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                Aucune évaluation enregistrée pour le moment.
              </div>
            ) : (
              <>
                {/* Evaluations sommatives */}
                {evaluations.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Évaluations sommatives</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {evaluations.map(a => {
                        const r = getResultat(child, a.id);
                        return (
                          <div key={a.id} style={{ ...CARD, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255,59,48,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📝</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{new Date(a.date).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}</div>
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                              {r?.level ? <LevelBadge level={r.level} /> : <span style={{ color: r?.value !== null && r?.value !== undefined ? "#f8fafc" : "rgba(255,255,255,0.3)", fontWeight: 800 }}>{scoreLabel(r, a.max_points)}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Devoirs / activités */}
                {devoirs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Devoirs & activités formatives</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {devoirs.map(a => {
                        const r = getResultat(child, a.id);
                        return (
                          <div key={a.id} style={{ ...CARD, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(10,132,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📚</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{new Date(a.date).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}</div>
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                              {r?.level ? <LevelBadge level={r.level} /> : <span style={{ color: r?.value !== null && r?.value !== undefined ? "#f8fafc" : "rgba(255,255,255,0.3)", fontWeight: 800 }}>{scoreLabel(r, a.max_points)}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Agenda tab */}
        {activeTab === "agenda" && (
          <div>
            {child.agendaItems.length === 0 ? (
              <div style={{ ...CARD, padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Aucun élément à venir dans l&apos;agenda.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {child.agendaItems.map(item => {
                  const isTest = item.type === "test";
                  const isHomework = item.type === "homework";
                  const icon = isTest ? "📝" : isHomework ? "📚" : "📖";
                  const iconBg = isTest ? "rgba(255,59,48,0.15)" : isHomework ? "rgba(10,132,255,0.15)" : "rgba(52,211,153,0.15)";
                  const daysLeft = Math.ceil((new Date(item.date).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={item.id} style={{ ...CARD, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>{item.title}</div>
                        {item.details && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3, lineHeight: 1.5 }}>{item.details}</div>}
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                          {new Date(item.date).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: daysLeft === 0 ? "#fbbf24" : daysLeft <= 2 ? "#fb923c" : "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>
                          {daysLeft === 0 ? "Aujourd'hui" : daysLeft === 1 ? "Demain" : `Dans ${daysLeft}j`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Remarques tab */}
        {activeTab === "remarques" && (
          <div>
            {child.remarques.length === 0 ? (
              <div style={{ ...CARD, padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Aucune remarque disciplinaire enregistrée.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {child.remarques.map(rem => (
                  <div key={rem.id} style={{ ...CARD, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(251,191,36,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>⚠️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#f8fafc", lineHeight: 1.6 }}>{rem.note}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                        {new Date(rem.date).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
                        {rem.teacher_name && ` · ${rem.teacher_name}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
