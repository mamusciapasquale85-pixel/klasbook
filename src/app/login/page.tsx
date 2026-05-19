"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const GRAD = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const ACCENT = "#0A84FF";
const ACCENT_LIGHT = "#eff6ff";
const ACCENT_DARK = "#1d4ed8";
const ACCENT_DISABLED = "#93c5fd";

const MATIERES = [
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

const GRADE_OPTIONS = [
  { label: "1ère primaire", value: 1 }, { label: "2ème primaire", value: 2 },
  { label: "3ème primaire", value: 3 }, { label: "4ème primaire", value: 4 },
  { label: "5ème primaire", value: 5 }, { label: "6ème primaire", value: 6 },
  { label: "1ère secondaire", value: 7 }, { label: "2ème secondaire", value: 8 },
  { label: "3ème secondaire", value: 9 }, { label: "4ème secondaire", value: 10 },
  { label: "5ème secondaire", value: 11 }, { label: "6ème secondaire", value: 12 },
];

type Mode = "login" | "forgot" | "r1" | "r2" | "r3" | "r4" | "r_student" | "r_parent" | "done";
type RegRole = "teacher" | "admin" | "student" | "parent";

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 12px", border: "2px solid #e5e7eb",
  borderRadius: 8, fontSize: "0.95rem", outline: "none", boxSizing: "border-box",
};

export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [mode, setMode] = useState<Mode>("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPwd, setRegPwd] = useState("");
  const [regPwd2, setRegPwd2] = useState("");
  const [regRole, setRegRole] = useState<RegRole>("teacher");
  const [schoolName, setSchoolName] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState(7);
  const [promoCode, setPromoCode] = useState("");
  // Student / parent specific
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [childFirstName, setChildFirstName] = useState("");
  const [childLastName, setChildLastName] = useState("");

  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginMsg(""); setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd });
    if (error) { setLoginLoading(false); setLoginMsg("Email ou mot de passe incorrect."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: memberships } = await supabase
      .from("school_memberships").select("role")
      .eq("user_id", user!.id).limit(1);
    const membership = memberships?.[0] ?? null;
    setLoginLoading(false);
    if (!membership) { window.location.href = "/onboarding"; return; }
    if (membership.role === "admin") window.location.href = "/direction";
    else if (membership.role === "parent") window.location.href = "/parent";
    else if (membership.role === "student") window.location.href = "/eleve";
    else window.location.href = "/dashboard";
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    await supabase.auth.resetPasswordForEmail(loginEmail, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    setLoginLoading(false);
    setLoginMsg("✅ Email envoyé ! Vérifiez votre boîte mail.");
  }

  function toggleSubject(id: string) {
    setSubjects(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function nextStep(from: Mode) {
    setRegError("");
    if (from === "r1") {
      if (!firstName.trim() || !lastName.trim() || !regEmail.trim() || !regPwd) { setRegError("Tous les champs sont requis."); return; }
      if (regPwd.length < 6) { setRegError("Le mot de passe doit contenir au moins 6 caractères."); return; }
      if (regPwd !== regPwd2) { setRegError("Les mots de passe ne correspondent pas."); return; }
      setMode("r2");
    } else if (from === "r2") {
      if (regRole === "student") setMode("r_student");
      else if (regRole === "parent") setMode("r_parent");
      else setMode("r3");
    } else if (from === "r3") {
      if (!schoolName.trim()) { setRegError("Veuillez indiquer votre école."); return; }
      if (regRole === "teacher") setMode("r4");
      else submitRegistration();
    } else if (from === "r4") {
      submitRegistration();
    }
  }

  async function submitStudent() {
    if (!schoolName.trim()) { setRegError("Veuillez indiquer le nom de votre école."); return; }
    if (!studentFirstName.trim() || !studentLastName.trim()) { setRegError("Prénom et nom requis."); return; }
    setRegError(""); setRegLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, email: regEmail.trim().toLowerCase(), password: regPwd,
          role: "student", schoolName,
          studentFirstName: studentFirstName.trim(),
          studentLastName: studentLastName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error || "Erreur."); setRegLoading(false); return; }
      await supabase.auth.signInWithPassword({ email: regEmail.trim().toLowerCase(), password: regPwd });
      setRegLoading(false);
      setMode("done");
      setTimeout(() => { window.location.href = "/eleve"; }, 1500);
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "Erreur");
      setRegLoading(false);
    }
  }

  async function submitParent() {
    if (!schoolName.trim()) { setRegError("Veuillez indiquer le nom de l'école."); return; }
    if (!childFirstName.trim() || !childLastName.trim()) { setRegError("Prénom et nom de l'enfant requis."); return; }
    setRegError(""); setRegLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, email: regEmail.trim().toLowerCase(), password: regPwd,
          role: "parent", schoolName,
          childFirstName: childFirstName.trim(),
          childLastName: childLastName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error || "Erreur."); setRegLoading(false); return; }
      await supabase.auth.signInWithPassword({ email: regEmail.trim().toLowerCase(), password: regPwd });
      setRegLoading(false);
      setMode("done");
      setTimeout(() => { window.location.href = "/parent"; }, 1500);
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "Erreur");
      setRegLoading(false);
    }
  }

  async function submitRegistration() {
    setRegError(""); setRegLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName,
          email: regEmail.trim().toLowerCase(),
          password: regPwd,
          role: regRole,
          schoolName, subjects, className, gradeLevel,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error || "Erreur lors de la création du compte."); setRegLoading(false); return; }
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: regEmail.trim().toLowerCase(), password: regPwd });
      setRegLoading(false);
      if (signInErr) { setRegError("Compte créé mais connexion échouée."); return; }
      setMode("done");
      setTimeout(() => { window.location.href = data.redirectTo || "/dashboard"; }, 1500);
    } catch {
      setRegError("Erreur réseau. Réessayez."); setRegLoading(false);
    }
  }

  const [showDemoMenu, setShowDemoMenu] = useState(false);
  function handleDemo(role: "prof" | "direction" | "parents") {
    setLoginLoading(true);
    window.location.href = `/api/demo?role=${role}`;
  }

  const isRegMode = ["r1", "r2", "r3", "r4", "r_student", "r_parent", "done"].includes(mode);

  const regSteps = regRole === "teacher"
    ? ["Identité", "Fonction", "École", "Matières"]
    : regRole === "student" || regRole === "parent"
      ? ["Identité", "Fonction", "Établissement"]
      : ["Identité", "Fonction", "École"];

  const regStepIdx = mode === "r1" ? 0 : mode === "r2" ? 1 : ["r3", "r_student", "r_parent"].includes(mode) ? 2 : mode === "r4" ? 3 : 3;

  return (
    <main style={{ minHeight: "100vh", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "40px 44px 44px", width: "100%", maxWidth: 460, boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>Klasbook</h1>
          <p style={{ color: "#6b7280", marginTop: 6, fontSize: "0.88rem" }}>La gestion de classe simplifiée</p>
        </div>

        {mode !== "forgot" && mode !== "done" && (
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 28 }}>
            <button onClick={() => { setMode("login"); setLoginMsg(""); }} style={{ flex: 1, padding: 10, border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", background: !isRegMode ? "white" : "transparent", color: !isRegMode ? ACCENT : "#6b7280", boxShadow: !isRegMode ? "0 2px 8px rgba(0,0,0,0.1)" : "none" }}>
              Se connecter
            </button>
            <button onClick={() => { setMode("r1"); setRegError(""); }} style={{ flex: 1, padding: 10, border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", background: isRegMode ? "white" : "transparent", color: isRegMode ? ACCENT : "#6b7280", boxShadow: isRegMode ? "0 2px 8px rgba(0,0,0,0.1)" : "none" }}>
              Créer un compte
            </button>
          </div>
        )}

        {/* LOGIN */}
        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <Lbl>Email</Lbl>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="prof@ecole.be" required style={{ ...inp, marginBottom: 16 }} />
            <Lbl>Mot de passe</Lbl>
            <input type="password" value={loginPwd} onChange={e => setLoginPwd(e.target.value)} placeholder="••••••••" required style={{ ...inp, marginBottom: 8 }} />
            <div style={{ textAlign: "right", marginBottom: 20 }}>
              <button type="button" onClick={() => { setMode("forgot"); setLoginMsg(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: ACCENT, fontSize: 13, fontWeight: 600, padding: 0 }}>Mot de passe oublié ?</button>
            </div>
            <Btn loading={loginLoading}>Se connecter</Btn>
            {loginMsg && <Msg error>{loginMsg}</Msg>}
            <div style={{ marginTop: 20 }}>
              <Sep />
              {!showDemoMenu ? (
                <button type="button" disabled={loginLoading} onClick={() => setShowDemoMenu(true)}
                  style={{ width: "100%", padding: 12, background: GRAD, color: "white", border: "none", borderRadius: 8, fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" }}>
                  🎮 Essayer la démo
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280", margin: "0 0 4px" }}>Choisissez un profil :</p>
                  {([
                    { role: "prof", icon: "📚", label: "Professeur", desc: "Classes, évaluations, remédiations" },
                    { role: "direction", icon: "🏫", label: "Direction", desc: "Vue d'ensemble de l'établissement" },
                    { role: "parents", icon: "👨‍👩‍👧", label: "Parent", desc: "Résultats et suivi de votre enfant" },
                  ] as const).map(({ role, icon, label, desc }) => (
                    <button key={role} type="button" disabled={loginLoading} onClick={() => handleDemo(role)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "#f8fafc", border: "2px solid #e5e7eb", borderRadius: 9, cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = ACCENT)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>
                      <span style={{ fontSize: "1.4rem" }}>{icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#111827" }}>{label}</div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{desc}</div>
                      </div>
                      <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 14 }}>→</span>
                    </button>
                  ))}
                </div>
              )}
              <p style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#9ca3af" }}>Accès instantané · Aucune inscription requise</p>
            </div>
          </form>
        )}

        {/* FORGOT */}
        {mode === "forgot" && (
          <>
            <button onClick={() => { setMode("login"); setLoginMsg(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>← Retour</button>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>Mot de passe oublié</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Entrez votre email — un lien de réinitialisation vous sera envoyé.</p>
            <form onSubmit={handleForgot}>
              <Lbl>Email</Lbl>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="prof@ecole.be" required style={{ ...inp, marginBottom: 20 }} />
              <Btn loading={loginLoading}>Envoyer le lien</Btn>
            </form>
            {loginMsg && <Msg success>{loginMsg}</Msg>}
          </>
        )}

        {/* REGISTER WIZARD */}
        {isRegMode && mode !== "done" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 28 }}>
              {regSteps.map((label, i) => {
                const done = i < regStepIdx;
                const active = i === regStepIdx;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? ACCENT : active ? GRAD : "#e5e7eb", color: done || active ? "white" : "#9ca3af", fontWeight: 700, fontSize: "0.82rem", boxShadow: active ? `0 0 0 3px white, 0 0 0 5px ${ACCENT}` : "none" }}>
                        {done ? "✓" : i + 1}
                      </div>
                      <span style={{ fontSize: "0.68rem", color: active ? ACCENT_DARK : done ? ACCENT : "#9ca3af", fontWeight: active ? 700 : 500, whiteSpace: "nowrap" }}>{label}</span>
                    </div>
                    {i < regSteps.length - 1 && <div style={{ width: 40, height: 2, background: done ? ACCENT : "#e5e7eb", margin: "0 4px", marginBottom: 16 }} />}
                  </div>
                );
              })}
            </div>

            {/* ÉTAPE 1 — Identité */}
            {mode === "r1" && (
              <div>
                <h3 style={{ margin: "0 0 20px", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Vos informations</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div><Lbl>Prénom</Lbl><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" required style={inp} /></div>
                  <div><Lbl>Nom</Lbl><input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" required style={inp} /></div>
                </div>
                <Lbl>Adresse email</Lbl>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="prof@ecole.be" required style={{ ...inp, marginBottom: 14 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
                  <div><Lbl>Mot de passe</Lbl><input type="password" value={regPwd} onChange={e => setRegPwd(e.target.value)} placeholder="••••••••" required minLength={6} style={inp} /></div>
                  <div><Lbl>Confirmer</Lbl><input type="password" value={regPwd2} onChange={e => setRegPwd2(e.target.value)} placeholder="••••••••" required style={inp} /></div>
                </div>
                {regError && <ErrBox>{regError}</ErrBox>}
                <div style={{ marginTop: 20 }}><Btn loading={false} onClick={() => nextStep("r1")}>Continuer →</Btn></div>
              </div>
            )}

            {/* ÉTAPE 2 — Fonction */}
            {mode === "r2" && (
              <div>
                <h3 style={{ margin: "0 0 20px", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Votre fonction</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {([
                    { value: "teacher", label: "Enseignant(e)", desc: "Gérer mes classes, évaluations et compétences", icon: "📚" },
                    { value: "admin",   label: "Direction",     desc: "Accès à l'ensemble de l'établissement",       icon: "🏫" },
                    { value: "parent",  label: "Parent",        desc: "Suivre les résultats de mon enfant",           icon: "👨‍👩‍👧" },
                    { value: "student", label: "Élève",         desc: "Voir mes résultats et mes remédiations",       icon: "🎒" },
                  ] as const).map(r => (
                    <button key={r.value} type="button" onClick={() => setRegRole(r.value)}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: regRole === r.value ? `2px solid ${ACCENT}` : "2px solid #e5e7eb", borderRadius: 10, background: regRole === r.value ? ACCENT_LIGHT : "white", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: "1.5rem" }}>{r.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: "#111827", fontSize: "0.95rem" }}>{r.label}</div>
                        <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 2 }}>{r.desc}</div>
                      </div>
                      {regRole === r.value && <span style={{ marginLeft: "auto", color: ACCENT, fontWeight: 700 }}>✓</span>}
                    </button>
                  ))}
                </div>
                {regError && <ErrBox>{regError}</ErrBox>}
                <div style={{ display: "flex", gap: 10 }}>
                  <BackBtn onClick={() => setMode("r1")} />
                  <div style={{ flex: 2 }}><Btn loading={false} onClick={() => nextStep("r2")}>Continuer →</Btn></div>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 — École (teacher/admin) */}
            {mode === "r3" && (
              <div>
                <h3 style={{ margin: "0 0 20px", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Votre établissement</h3>
                <Lbl>Nom de l'école / l'institut</Lbl>
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Institut Marie Curie, Bruxelles" required style={{ ...inp, marginBottom: 8 }} />
                <p style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 16 }}>Si votre établissement existe déjà dans Klasbook, vous serez automatiquement rattaché.</p>
                <Lbl>Code promo <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optionnel)</span></Lbl>
                <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Votre code d'accès" style={{ ...inp, marginBottom: 20, letterSpacing: "0.05em" }} />
                {regError && <ErrBox>{regError}</ErrBox>}
                <div style={{ display: "flex", gap: 10 }}>
                  <BackBtn onClick={() => setMode("r2")} />
                  <div style={{ flex: 2 }}>
                    <Btn loading={regLoading} onClick={() => nextStep("r3")}>
                      {regRole === "teacher" ? "Continuer →" : regLoading ? "Création…" : "Créer mon Klasbook →"}
                    </Btn>
                  </div>
                </div>
              </div>
            )}

            {/* ÉTAPE 4 — Matières (teacher) */}
            {mode === "r4" && (
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Vos matières</h3>
                <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 14 }}>Votre Klasbook sera personnalisé en fonction de vos matières.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
                  {MATIERES.map(m => {
                    const sel = subjects.includes(m.id);
                    return (
                      <button key={m.id} type="button" onClick={() => toggleSubject(m.id)}
                        style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 11px", borderRadius: 9, cursor: "pointer", border: sel ? `2px solid ${ACCENT}` : "2px solid #e5e7eb", background: sel ? ACCENT_LIGHT : "white", fontWeight: sel ? 700 : 500, fontSize: "0.82rem", color: sel ? ACCENT_DARK : "#374151", textAlign: "left" }}>
                        <span style={{ fontSize: "1.1rem" }}>{m.emoji}</span>
                        <span style={{ flex: 1 }}>{m.label}</span>
                        {sel && <span style={{ color: ACCENT, fontSize: "0.75rem" }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
                <Lbl>Classe principale (optionnel)</Lbl>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
                  <input value={className} onChange={e => setClassName(e.target.value)} placeholder="ex: 3B Néerlandais" style={inp} />
                  <select value={gradeLevel} onChange={e => setGradeLevel(Number(e.target.value))} style={{ ...inp, cursor: "pointer" }}>
                    {GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: 16 }}>Vous pourrez ajouter d'autres classes plus tard.</p>
                {regError && <ErrBox>{regError}</ErrBox>}
                <div style={{ display: "flex", gap: 10 }}>
                  <BackBtn onClick={() => setMode("r3")} />
                  <div style={{ flex: 2 }}><Btn loading={regLoading} onClick={() => nextStep("r4")}>{regLoading ? "Création de votre Klasbook…" : "Créer mon Klasbook →"}</Btn></div>
                </div>
              </div>
            )}

            {/* ÉTAPE ÉLÈVE */}
            {mode === "r_student" && (
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Ton établissement</h3>
                <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 16 }}>Entre le nom de ton école et ton prénom/nom tels qu'enregistrés par ton professeur.</p>
                <Lbl>Nom de l'école</Lbl>
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Lab Marie Curie" required style={{ ...inp, marginBottom: 14 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
                  <div><Lbl>Ton prénom</Lbl><input value={studentFirstName} onChange={e => setStudentFirstName(e.target.value)} placeholder="Emma" required style={inp} /></div>
                  <div><Lbl>Ton nom</Lbl><input value={studentLastName} onChange={e => setStudentLastName(e.target.value)} placeholder="Dupont" required style={inp} /></div>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: 16 }}>Si tu n'es pas trouvé(e), demande à ton professeur de vérifier ton nom dans Klasbook.</p>
                {regError && <ErrBox>{regError}</ErrBox>}
                <div style={{ display: "flex", gap: 10 }}>
                  <BackBtn onClick={() => setMode("r2")} />
                  <div style={{ flex: 2 }}><Btn loading={regLoading} onClick={() => void submitStudent()}>{regLoading ? "Recherche…" : "Accéder à mon espace →"}</Btn></div>
                </div>
              </div>
            )}

            {/* ÉTAPE PARENT */}
            {mode === "r_parent" && (
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Votre établissement et votre enfant</h3>
                <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 16 }}>Entrez le nom de l'école et les informations de votre enfant telles qu'enregistrées.</p>
                <Lbl>Nom de l'école</Lbl>
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Lab Marie Curie" required style={{ ...inp, marginBottom: 14 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
                  <div><Lbl>Prénom de l'enfant</Lbl><input value={childFirstName} onChange={e => setChildFirstName(e.target.value)} placeholder="Emma" required style={inp} /></div>
                  <div><Lbl>Nom de l'enfant</Lbl><input value={childLastName} onChange={e => setChildLastName(e.target.value)} placeholder="Dupont" required style={inp} /></div>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: 16 }}>Le prénom et nom doivent correspondre à ceux enregistrés par l'école.</p>
                {regError && <ErrBox>{regError}</ErrBox>}
                <div style={{ display: "flex", gap: 10 }}>
                  <BackBtn onClick={() => setMode("r2")} />
                  <div style={{ flex: 2 }}><Btn loading={regLoading} onClick={() => void submitParent()}>{regLoading ? "Recherche…" : "Accéder à mon espace →"}</Btn></div>
                </div>
              </div>
            )}
          </>
        )}

        {/* DONE */}
        {mode === "done" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111827", margin: "0 0 10px" }}>Votre Klasbook est prêt !</h2>
            <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Redirection en cours…</p>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.72rem", color: "#9ca3af" }}>
          LYCÉE ALTERNATIF BRUXELLOIS · LAB Marie Curie
        </p>
      </div>
    </main>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 600, color: "#374151", marginBottom: 5 }}>{children}</label>;
}
function Btn({ children, loading, onClick }: { children: React.ReactNode; loading: boolean; onClick?: () => void }) {
  return (
    <button type={onClick ? "button" : "submit"} onClick={onClick} disabled={loading}
      style={{ width: "100%", padding: 13, background: loading ? ACCENT_DISABLED : GRAD, color: "white", border: "none", borderRadius: 8, fontSize: "0.95rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
      {children}
    </button>
  );
}
function BackBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ padding: "13px 18px", background: "#f3f4f6", color: "#374151", border: "2px solid #e5e7eb", borderRadius: 8, fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>← Retour</button>;
}
function ErrBox({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: "0.83rem" }}>{children}</div>;
}
function Msg({ children, error, success }: { children: React.ReactNode; error?: boolean; success?: boolean }) {
  return <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: error ? "#fef2f2" : success ? "#f0fdf4" : "#f9fafb", color: error ? "#dc2626" : success ? "#16a34a" : "#374151", fontSize: "0.83rem", textAlign: "center" }}>{children}</div>;
}
function Sep() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
      <span style={{ fontSize: 11, color: "#9ca3af" }}>ou</span>
      <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
    </div>
  );
}
