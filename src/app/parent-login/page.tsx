"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const BG = "#0f172a";
const CARD_BG = "#1e293b";
const BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "#0A84FF";
const GRAD = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

type Mode = "login" | "register" | "forgot" | "done";

function Input({ label, type = "text", value, onChange, placeholder }: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          padding: "12px 14px",
          fontSize: 15,
          color: "#f8fafc",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function Btn({ children, onClick, loading, secondary }: {
  children: React.ReactNode; onClick: () => void;
  loading?: boolean; secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%",
        padding: "14px",
        borderRadius: 12,
        border: secondary ? `1px solid ${BORDER}` : "none",
        background: secondary ? "transparent" : ACCENT,
        color: "#fff",
        fontSize: 15,
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "…" : children}
    </button>
  );
}

export default function ParentLoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // Login
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  // Register
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPwd, setRegPwd] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [childFirstName, setChildFirstName] = useState("");
  const [childLastName, setChildLastName] = useState("");

  async function handleLogin() {
    if (!email || !pwd) { setError("Email et mot de passe requis."); return; }
    setError(""); setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pwd });
    setLoading(false);
    if (err) { setError("Email ou mot de passe incorrect."); return; }
    // Vérifier que c'est bien un parent
    const meta = data.user?.user_metadata;
    if (meta?.role && meta.role !== "parent") {
      await supabase.auth.signOut();
      setError("Ce compte n'est pas un compte parent. Utilisez la page de connexion enseignant.");
      return;
    }
    window.location.href = "/parent";
  }

  async function handleRegister() {
    if (!firstName.trim() || !lastName.trim()) { setError("Prénom et nom requis."); return; }
    if (!regEmail.trim() || !regPwd) { setError("Email et mot de passe requis."); return; }
    if (regPwd.length < 8) { setError("Mot de passe minimum 8 caractères."); return; }
    if (!schoolName.trim()) { setError("Nom de l'école requis."); return; }
    if (!childFirstName.trim() || !childLastName.trim()) { setError("Prénom et nom de l'enfant requis."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPwd,
          role: "parent",
          schoolName: schoolName.trim(),
          childFirstName: childFirstName.trim(),
          childLastName: childLastName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur lors de l'inscription."); setLoading(false); return; }
      await supabase.auth.signInWithPassword({ email: regEmail.trim().toLowerCase(), password: regPwd });
      setLoading(false);
      setMode("done");
      setTimeout(() => { window.location.href = "/parent"; }, 2000);
    } catch {
      setError("Erreur réseau. Réessayez.");
      setLoading(false);
    }
  }

  async function handleForgot() {
    if (!email.trim()) { setError("Entrez votre adresse email."); return; }
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/parent`,
    });
    setLoading(false);
    if (err) { setError("Erreur : " + err.message); return; }
    setMsg("Email envoyé ! Vérifiez votre boîte mail.");
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>

      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>👨‍👩‍👧</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Klasbook
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.45)" }}>Portail Parents</p>
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 400, background: CARD_BG, borderRadius: 20, border: `1px solid ${BORDER}`, padding: "28px 24px" }}>

        {/* Tabs login/register */}
        {mode !== "done" && mode !== "forgot" && (
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setMsg(""); }}
                style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 14,
                  background: mode === m ? ACCENT : "transparent",
                  color: mode === m ? "#fff" : "rgba(255,255,255,0.45)",
                }}>
                {m === "login" ? "Connexion" : "Créer un compte"}
              </button>
            ))}
          </div>
        )}

        {/* SUCCESS */}
        {mode === "done" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>Compte créé !</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
              Redirection vers votre portail…
            </div>
          </div>
        )}

        {/* LOGIN */}
        {mode === "login" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="votre@email.com" />
            <Input label="Mot de passe" type="password" value={pwd} onChange={setPwd} placeholder="••••••••" />
            {error && <p style={{ margin: 0, color: "#fca5a5", fontSize: 13 }}>{error}</p>}
            {msg && <p style={{ margin: 0, color: "#86efac", fontSize: 13 }}>{msg}</p>}
            <Btn onClick={handleLogin} loading={loading}>Se connecter</Btn>
            <button onClick={() => { setMode("forgot"); setError(""); setMsg(""); }}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", textAlign: "center" }}>
              Mot de passe oublié ?
            </button>
          </div>
        )}

        {/* FORGOT PASSWORD */}
        {mode === "forgot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>Réinitialiser le mot de passe</div>
            <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="votre@email.com" />
            {error && <p style={{ margin: 0, color: "#fca5a5", fontSize: 13 }}>{error}</p>}
            {msg && <p style={{ margin: 0, color: "#86efac", fontSize: 13 }}>{msg}</p>}
            <Btn onClick={handleForgot} loading={loading}>Envoyer le lien</Btn>
            <Btn onClick={() => { setMode("login"); setError(""); setMsg(""); }} secondary>← Retour</Btn>
          </div>
        )}

        {/* REGISTER */}
        {mode === "register" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Input label="Prénom" value={firstName} onChange={setFirstName} /></div>
              <div style={{ flex: 1 }}><Input label="Nom" value={lastName} onChange={setLastName} /></div>
            </div>
            <Input label="Email" type="email" value={regEmail} onChange={setRegEmail} placeholder="votre@email.com" />
            <Input label="Mot de passe" type="password" value={regPwd} onChange={setRegPwd} placeholder="Minimum 8 caractères" />

            <div style={{ height: 1, background: BORDER, margin: "4px 0" }} />
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Informations école & enfant
            </p>
            <Input label="Nom de l'école" value={schoolName} onChange={setSchoolName} placeholder="Ex : Institut Saint-Pierre" />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Input label="Prénom enfant" value={childFirstName} onChange={setChildFirstName} /></div>
              <div style={{ flex: 1 }}><Input label="Nom enfant" value={childLastName} onChange={setChildLastName} /></div>
            </div>

            {error && <p style={{ margin: 0, color: "#fca5a5", fontSize: 13 }}>{error}</p>}
            <Btn onClick={handleRegister} loading={loading}>Créer mon compte</Btn>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.5 }}>
              Après inscription, l'école devra valider le lien avec votre enfant.
            </p>
          </div>
        )}
      </div>

      {/* Lien vers login enseignant */}
      <p style={{ marginTop: 24, fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
        Vous êtes enseignant ?{" "}
        <a href="/login" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>Connexion enseignant</a>
      </p>
    </div>
  );
}
