"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type Role = "teacher" | "admin" | "parent" | "student";

const GRADE_OPTIONS = [
  { label: "1ère primaire", value: 1 },
  { label: "2ème primaire", value: 2 },
  { label: "3ème primaire", value: 3 },
  { label: "4ème primaire", value: 4 },
  { label: "5ème primaire", value: 5 },
  { label: "6ème primaire", value: 6 },
  { label: "1ère secondaire", value: 7 },
  { label: "2ème secondaire", value: 8 },
  { label: "3ème secondaire", value: 9 },
  { label: "4ème secondaire", value: 10 },
  { label: "5ème secondaire", value: 11 },
  { label: "6ème secondaire", value: 12 },
];

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const ACCENT = "#0A84FF";
const ACCENT_LIGHT = "#eff6ff";
const ACCENT_BORDER = "#bfdbfe";
const ACCENT_DARK = "#1d4ed8";
const ACCENT_DISABLED = "#93c5fd";

const MATIERES_DISPONIBLES = [
  { id: "nl",            label: "Néerlandais",      emoji: "🇳🇱" },
  { id: "francais",      label: "Français",          emoji: "📖" },
  { id: "mathematiques", label: "Mathématiques",     emoji: "📐" },
  { id: "sciences",      label: "Sciences",          emoji: "🔬" },
  { id: "histoire",      label: "Histoire",          emoji: "🏛️" },
  { id: "geographie",    label: "Géographie",        emoji: "🗺️" },
  { id: "anglais",       label: "Anglais",           emoji: "🇬🇧" },
  { id: "allemand",      label: "Allemand",          emoji: "🇩🇪" },
  { id: "espagnol",      label: "Espagnol",          emoji: "🇪🇸" },
  { id: "latin",         label: "Latin",             emoji: "⚱️" },
  { id: "ed_physique",   label: "Éd. physique",      emoji: "⚽" },
  { id: "arts",          label: "Arts / Musique",    emoji: "🎨" },
  { id: "religion",      label: "Religion / Morale", emoji: "✝️" },
  { id: "informatique",  label: "Informatique",      emoji: "💻" },
  { id: "autre",         label: "Autre",             emoji: "📚" },
];

const ROLES: { value: Role; label: string; description: string; icon: string }[] = [
  { value: "teacher", label: "Enseignant(e)", description: "Gérer mes classes et évaluations", icon: "📚" },
  { value: "admin",   label: "Direction",     description: "Accès complet à l'établissement",  icon: "🏫" },
  { value: "parent",  label: "Parent",        description: "Suivre les résultats de mon enfant", icon: "👨‍👩‍👧" },
  { value: "student", label: "Élève",         description: "Pratiquer et voir mes résultats",  icon: "🎒" },
];

const STEP_LABELS: Record<Role, string[]> = {
  teacher: ["Profil", "Matières", "Classe"],
  admin:   ["Profil", "École"],
  parent:  ["Profil", "Enfant"],
  student: ["Profil", "École"],
};

function getStepIndex(step: Step, role: Role): number {
  if (step === 1) return 0;
  if (step === 5) return 1; // teacher: matières
  if (step === 2) return role === "teacher" ? 2 : 1;
  if (step === 3) return 1; // parent: enfant
  if (step === 6) return 1; // student: école
  return -1; // step 4 = success, no indicator
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("teacher");
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState(7);
  const [childFirstName, setChildFirstName] = useState("");
  const [childLastName, setChildLastName] = useState("");
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [selectedMatieres, setSelectedMatieres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (role === "parent") setStep(3);
    else if (role === "teacher") setStep(5);
    else if (role === "student") setStep(6);
    else setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      await supabase.from("user_profiles").upsert({
        id: user.id, full_name: fullName, display_role: role, locale: "fr",
      });

      let school: { id: string } | null = null;
      const { data: existing } = await supabase.from("schools").select("id").ilike("name", schoolName.trim()).limit(1).maybeSingle();
      if (existing) {
        school = existing;
      } else {
        const { data: newSchool, error: se } = await supabase.from("schools").insert({ name: schoolName.trim() }).select("id").single();
        if (se) throw se;
        school = newSchool;
      }

      await supabase.from("school_memberships").upsert(
        { school_id: school!.id, user_id: user.id, role },
        { onConflict: "school_id,user_id" }
      );

      const { data: year } = await supabase.from("academic_years").select("id").eq("school_id", school!.id).limit(1).maybeSingle();
      let yearId = year?.id;
      if (!yearId) {
        const { data: newYear } = await supabase.from("academic_years")
          .insert({ school_id: school!.id, name: "2025-2026", start_date: "2025-09-01", end_date: "2026-06-30" })
          .select("id").single();
        yearId = newYear?.id;
      }

      if (role === "teacher" && className.trim() && yearId) {
        await supabase.from("class_groups").insert({
          school_id: school!.id, academic_year_id: yearId,
          name: className.trim(), grade_level: gradeLevel, teacher_id: user.id,
        });
      }

      if (role === "teacher" && selectedMatieres.length > 0) {
        const coursRows = selectedMatieres.map(id => {
          const mat = MATIERES_DISPONIBLES.find(m => m.id === id);
          return { school_id: school!.id, name: mat?.label ?? id, subject_area: id, grade_band: "secondaire" };
        });
        await supabase.from("courses").insert(coursRows);
        const primaryLabel = MATIERES_DISPONIBLES.find(m => m.id === selectedMatieres[0])?.label ?? selectedMatieres[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("school_memberships").update({ matiere: primaryLabel }).eq("user_id", user.id).eq("school_id", school!.id);
      }

      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  function handleStep5(e: React.FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      await supabase.from("user_profiles").upsert({
        id: user.id, full_name: fullName, display_role: "parent", locale: "fr",
      });

      const { data: school } = await supabase.from("schools").select("id").ilike("name", schoolName.trim()).limit(1).maybeSingle();
      if (!school) throw new Error("École introuvable. Vérifiez le nom de l'établissement.");

      await supabase.from("school_memberships").upsert(
        { school_id: school.id, user_id: user.id, role: "parent" },
        { onConflict: "school_id,user_id" }
      );

      const { data: student } = await supabase.from("students").select("id")
        .ilike("first_name", childFirstName.trim())
        .ilike("last_name", childLastName.trim())
        .eq("school_id", school.id)
        .limit(1).maybeSingle();

      if (!student) throw new Error("Enfant introuvable dans cet établissement. Vérifiez le prénom et le nom.");

      await supabase.from("parent_links").insert({
        school_id: school.id, parent_user_id: user.id,
        student_id: student.id, relationship: "parent", visibility_level: "full",
      });

      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  // ─── CORRIGÉ : erreurs upsert maintenant détectées ───────────────────────
  async function handleStep6(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      const { data: rpcResult, error: rpcError } = await supabase.rpc("find_student_for_onboarding", {
        p_school_name: schoolName.trim(),
        p_first_name: studentFirstName.trim(),
        p_last_name: studentLastName.trim(),
      });
      if (rpcError) throw new Error("Erreur lors de la recherche : " + rpcError.message);

      const match = rpcResult?.[0];
      if (!match) throw new Error("Élève introuvable dans cet établissement. Demande à ton professeur de vérifier que ton nom est bien enregistré.");

      const school = { id: match.school_id };
      const student = { id: match.student_id };

      const { error: profileError } = await supabase.from("user_profiles").upsert({
        id: user.id,
        full_name: fullName || `${studentFirstName} ${studentLastName}`,
        display_role: "student",
        locale: "fr",
        template_json: { student_id: student.id, school_id: school.id },
      });
      if (profileError) throw new Error("Erreur profil : " + profileError.message);

      const { error: memberError } = await supabase.from("school_memberships").upsert(
        { school_id: school.id, user_id: user.id, role: "student" },
        { onConflict: "school_id,user_id" }
      );
      if (memberError) throw new Error("Erreur inscription : " + memberError.message);

      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  function toggleMatiere(id: string) {
    setSelectedMatieres(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  }

  function goToApp() {
    if (role === "admin") router.push("/direction");
    else if (role === "parent") router.push("/parent");
    else if (role === "student") router.push("/vocal");
    else router.push("/dashboard");
  }

  const labels = STEP_LABELS[role];
  const currentStepIndex = getStepIndex(step, role);
  const showProgress = step !== 4;

  return (
    <main style={{ minHeight: "100vh", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: "24px" }}>
      <div style={{ background: "white", borderRadius: "16px", padding: "40px 48px 48px", width: "100%", maxWidth: "520px", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "800", background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
            Klasbook
          </h1>
          <p style={{ color: "#6b7280", marginTop: "6px", fontSize: "0.9rem" }}>Configuration de votre espace</p>
        </div>

        {/* Step progress indicator */}
        {showProgress && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: "32px" }}>
            {labels.map((label, i) => {
              const done = i < currentStepIndex;
              const active = i === currentStepIndex;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: done ? ACCENT : active ? GRADIENT : "#e5e7eb",
                      color: done || active ? "white" : "#9ca3af",
                      fontWeight: "700", fontSize: "0.85rem",
                      boxShadow: active ? `0 0 0 3px white, 0 0 0 5px ${ACCENT}` : "none",
                      transition: "all 0.2s",
                    }}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span style={{ fontSize: "0.72rem", color: active ? ACCENT_DARK : done ? ACCENT : "#9ca3af", fontWeight: active ? 700 : 500, whiteSpace: "nowrap" }}>
                      {label}
                    </span>
                  </div>
                  {i < labels.length - 1 && (
                    <div style={{ width: "48px", height: "2px", background: done ? ACCENT : "#e5e7eb", margin: "0 4px", marginBottom: "18px", transition: "background 0.2s" }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Étape 1 : nom + rôle */}
        {step === 1 && (
          <form onSubmit={handleStep1}>
            <SectionTitle>Qui êtes-vous ?</SectionTitle>
            <Field label="Votre nom complet">
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Marie Dupont" required style={inputStyle} />
            </Field>
            <Field label="Votre rôle">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => setRole(r.value)} style={{
                    display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px",
                    border: role === r.value ? `2px solid ${ACCENT}` : "2px solid #e5e7eb",
                    borderRadius: "10px", background: role === r.value ? ACCENT_LIGHT : "white",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: "1.6rem" }}>{r.icon}</span>
                    <div>
                      <div style={{ fontWeight: "700", color: "#111827", fontSize: "0.95rem" }}>{r.label}</div>
                      <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "2px" }}>{r.description}</div>
                    </div>
                    {role === r.value && <span style={{ marginLeft: "auto", color: ACCENT, fontWeight: "700" }}>✓</span>}
                  </button>
                ))}
              </div>
            </Field>
            <SubmitButton loading={false} style={{ marginTop: "24px" }}>Continuer →</SubmitButton>
          </form>
        )}

        {/* Étape 2 : école + classe (teacher/admin) */}
        {step === 2 && (
          <form onSubmit={handleStep2}>
            <SectionTitle>{role === "admin" ? "Votre établissement" : "Votre école et classe"}</SectionTitle>
            <Field label="Nom de l'établissement">
              <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Institut Marie Curie" required style={inputStyle} />
            </Field>
            {role === "teacher" && (
              <>
                <Field label="Nom de votre première classe">
                  <input type="text" value={className} onChange={e => setClassName(e.target.value)}
                    placeholder={selectedMatieres.length > 0
                      ? `ex: 3B ${MATIERES_DISPONIBLES.find(m => m.id === selectedMatieres[0])?.label ?? ""}`
                      : "ex: 3B, Néerlandais 1A, …"}
                    required style={inputStyle} />
                </Field>
                <Field label="Niveau">
                  <select value={gradeLevel} onChange={e => setGradeLevel(Number(e.target.value))} style={{ ...inputStyle, cursor: "pointer" }}>
                    {GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <BackButton onClick={() => setStep(role === "teacher" ? 5 : 1)} />
              <SubmitButton loading={loading} style={{ flex: 2 }}>{loading ? "Création..." : "Continuer →"}</SubmitButton>
            </div>
          </form>
        )}

        {/* Étape 3 : parent → école + enfant */}
        {step === 3 && (
          <form onSubmit={handleStep3}>
            <SectionTitle>Votre établissement et votre enfant</SectionTitle>
            <Field label="Nom de l'établissement">
              <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Institut Marie Curie" required style={inputStyle} />
            </Field>
            <Field label="Prénom de votre enfant">
              <input type="text" value={childFirstName} onChange={e => setChildFirstName(e.target.value)} placeholder="Emma" required style={inputStyle} />
            </Field>
            <Field label="Nom de famille de votre enfant">
              <input type="text" value={childLastName} onChange={e => setChildLastName(e.target.value)} placeholder="Dupont" required style={inputStyle} />
            </Field>
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: "0 0 16px" }}>
              Le prénom et nom doivent correspondre à ceux enregistrés par l'école.
            </p>
            {error && <ErrorBox>{error}</ErrorBox>}
            <div style={{ display: "flex", gap: "12px" }}>
              <BackButton onClick={() => setStep(1)} />
              <SubmitButton loading={loading} style={{ flex: 2 }}>{loading ? "Recherche..." : "Accéder à mon espace →"}</SubmitButton>
            </div>
          </form>
        )}

        {/* Étape 4 : confirmation */}
        {step === 4 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎉</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#111827", margin: "0 0 12px" }}>C&apos;est parti !</h2>
            <p style={{ color: "#6b7280", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "32px" }}>
              {role === "student"
                ? "Ton espace est prêt. Tu peux maintenant pratiquer ta prononciation et voir tes résultats."
                : role === "parent"
                  ? "Votre espace est prêt. Vous pouvez suivre les résultats de votre enfant."
                  : role === "admin"
                    ? "Votre espace est prêt. Vous avez accès à l'ensemble de l'établissement."
                    : selectedMatieres.length > 0
                      ? `Votre Klasbook est configuré pour ${selectedMatieres.map(id => MATIERES_DISPONIBLES.find(m => m.id === id)?.label).join(", ")}. Vos outils et suggestions IA sont adaptés à votre contexte.`
                      : "Votre espace est prêt. Vous pouvez gérer vos classes et évaluations."}
            </p>
            <button onClick={goToApp} style={{ width: "100%", padding: "14px", background: GRADIENT, color: "white", border: "none", borderRadius: "8px", fontSize: "1rem", fontWeight: "700", cursor: "pointer" }}>
              Accéder à mon espace →
            </button>
          </div>
        )}

        {/* Étape 5 : matières enseignées */}
        {step === 5 && (
          <form onSubmit={handleStep5}>
            <SectionTitle>Quelle(s) matière(s) enseignez-vous ?</SectionTitle>
            <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "16px", marginTop: "-8px" }}>
              Votre Klasbook sera configuré en fonction de vos matières : suggestions IA, modèles d&apos;évaluations, terminologie adaptée.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "20px" }}>
              {MATIERES_DISPONIBLES.map(m => {
                const selected = selectedMatieres.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMatiere(m.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                      border: selected ? `2px solid ${ACCENT}` : "2px solid #e5e7eb",
                      background: selected ? ACCENT_LIGHT : "white",
                      fontWeight: selected ? 700 : 500, fontSize: "0.875rem",
                      color: selected ? ACCENT_DARK : "#374151",
                      textAlign: "left", transition: "all 0.12s",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>{m.emoji}</span>
                    <span style={{ flex: 1 }}>{m.label}</span>
                    {selected && <span style={{ color: ACCENT, fontSize: "0.8rem" }}>✓</span>}
                  </button>
                );
              })}
            </div>
            {selectedMatieres.length > 0 && (
              <div style={{ background: ACCENT_LIGHT, border: `1px solid ${ACCENT_BORDER}`, borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "0.83rem", color: ACCENT_DARK }}>
                ✓ {selectedMatieres.map(id => MATIERES_DISPONIBLES.find(m => m.id === id)?.emoji + " " + MATIERES_DISPONIBLES.find(m => m.id === id)?.label).join(" · ")}
              </div>
            )}
            {selectedMatieres.length === 0 && (
              <p style={{ fontSize: "0.8rem", color: "#f59e0b", marginBottom: "12px" }}>
                💡 Sélectionnez au moins une matière pour personnaliser votre expérience.
              </p>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
            <div style={{ display: "flex", gap: "12px" }}>
              <BackButton onClick={() => setStep(1)} />
              <SubmitButton loading={false} style={{ flex: 2 }}>
                Continuer →
              </SubmitButton>
            </div>
          </form>
        )}

        {/* Étape 6 : élève → école + nom */}
        {step === 6 && (
          <form onSubmit={handleStep6}>
            <SectionTitle>Ton école et ton identité</SectionTitle>
            <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "16px", marginTop: "-8px" }}>
              Entre le nom de ton école et ton prénom/nom tels qu&apos;enregistrés par ton professeur.
            </p>
            <Field label="Nom de l'établissement">
              <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Institut Marie Curie" required style={inputStyle} />
            </Field>
            <Field label="Ton prénom">
              <input type="text" value={studentFirstName} onChange={e => setStudentFirstName(e.target.value)} placeholder="Emma" required style={inputStyle} />
            </Field>
            <Field label="Ton nom de famille">
              <input type="text" value={studentLastName} onChange={e => setStudentLastName(e.target.value)} placeholder="Dupont" required style={inputStyle} />
            </Field>
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: "0 0 16px" }}>
              Si tu n&apos;es pas trouvé(e), demande à ton professeur de vérifier que ton nom est bien enregistré dans Klasbook.
            </p>
            {error && <ErrorBox>{error}</ErrorBox>}
            <div style={{ display: "flex", gap: "12px" }}>
              <BackButton onClick={() => setStep(1)} />
              <SubmitButton loading={loading} style={{ flex: 2 }}>{loading ? "Recherche..." : "Accéder à mon espace →"}</SubmitButton>
            </div>
          </form>
        )}

        <p style={{ textAlign: "center", marginTop: "28px", fontSize: "0.75rem", color: "#9ca3af" }}>
          Klasbook · La gestion de classe simplifiée
        </p>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#111827", marginBottom: "20px", marginTop: 0 }}>{children}</h2>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: "16px", padding: "12px", borderRadius: "8px", background: "#fef2f2", color: "#dc2626", fontSize: "0.85rem" }}>{children}</div>;
}

function SubmitButton({ children, loading, style }: { children: React.ReactNode; loading: boolean; style?: React.CSSProperties }) {
  return (
    <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? ACCENT_DISABLED : GRADIENT, color: "white", border: "none", borderRadius: "8px", fontSize: "1rem", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", ...style }}>
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: "14px 20px", background: "#f3f4f6", color: "#374151", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "1rem", fontWeight: "600", cursor: "pointer" }}>
      ← Retour
    </button>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "0.95rem", outline: "none", boxSizing: "border-box", background: "white" };
