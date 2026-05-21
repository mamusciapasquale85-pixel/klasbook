import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Klasbook — Gagnez 3h par semaine en classe",
  description:
    "Transformez vos évaluations en remédiations et rapports PDF en quelques minutes. 100% aligné sur le référentiel FWB. Essai gratuit 14 jours, sans carte bancaire.",
  openGraph: {
    title: "Klasbook — Gagnez 3h par semaine en classe",
    description:
      "Évaluation → Diagnostic → Remédiation → Rapport PDF. L'assistant pédagogique conçu pour les profs FWB.",
    url: "https://klasbook.be/profs",
    siteName: "Klasbook",
    locale: "fr_BE",
    type: "website",
  },
};

const G = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const ACCENT = "#0A84FF";
const GREEN = "#10b981";

const gText: React.CSSProperties = {
  background: G,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

export default function ProfsLandingPage() {
  return (
    <div style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif", color: "#fff", minHeight: "100vh" }}>

      {/* NAV */}
      <nav style={{
        padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        position: "sticky", top: 0,
        background: "rgba(6,9,15,0.85)", backdropFilter: "blur(16px)",
        zIndex: 100,
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
          <span style={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>Klasbook</span>
        </Link>
        <Link href="/login?tab=register" style={{
          padding: "9px 20px", borderRadius: 10, background: G, color: "#fff",
          fontSize: 14, fontWeight: 700, textDecoration: "none",
          boxShadow: "0 8px 20px rgba(10,132,255,0.25)",
        }}>
          Essayer gratuitement
        </Link>
      </nav>

      {/* HERO */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px 56px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(10,132,255,0.12)", border: "1px solid rgba(10,132,255,0.25)",
          borderRadius: 999, padding: "5px 14px",
          color: ACCENT, fontSize: 12, fontWeight: 700, marginBottom: 24,
        }}>
          🇧🇪 Conçu pour la Fédération Wallonie-Bruxelles
        </div>

        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: 18 }}>
          Vos évaluations deviennent des<br />
          <span style={gText}>remédiations en quelques minutes.</span>
        </h1>

        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.7 }}>
          Klasbook transforme vos résultats par compétences en diagnostics, remédiations individualisées et rapports PDF — 100% aligné sur le référentiel FWB.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 36 }}>
          <Link href="/login?tab=register" style={{
            padding: "14px 28px", borderRadius: 14, background: G, color: "#fff",
            fontWeight: 800, fontSize: 15, textDecoration: "none",
            boxShadow: "0 12px 28px rgba(10,132,255,0.3)",
          }}>
            Créer mon compte gratuit ✨
          </Link>
          <Link href="/api/demo?role=prof" style={{
            padding: "14px 28px", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 15,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            textDecoration: "none",
          }}>
            🎮 Voir la démo
          </Link>
        </div>

        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
          {["Aucune carte bancaire requise", "14 jours d'essai gratuit", "Données hébergées en Europe"].map(t => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
              <span style={{ color: GREEN, fontSize: 8 }}>●</span>{t}
            </span>
          ))}
        </div>
      </section>

      {/* STATS */}
      <div style={{ maxWidth: 680, margin: "0 auto 64px", padding: "0 24px", display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { num: "3h+", label: "perdues par semaine sur l'administratif pédagogique" },
          { num: "0", label: "outil conçu pour le secondaire FWB avant Klasbook" },
          { num: "<5 min", label: "pour un rapport de remédiation complet par élève" },
        ].map(s => (
          <div key={s.num} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "20px 24px", flex: 1, minWidth: 150, maxWidth: 200 }}>
            <div style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-2px", lineHeight: 1, marginBottom: 6, ...gText }}>{s.num}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* FLOW */}
      <div style={{ maxWidth: 680, margin: "0 auto 64px", padding: "0 24px" }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "24px 28px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", fontWeight: 700, marginBottom: 14 }}>Ce que Klasbook fait pour vous</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {["📋 Évaluation", "🔍 Diagnostic", "✏️ Remédiation", "📄 Rapport PDF"].map((step, i, arr) => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>{step}</span>
                {i < arr.length - 1 && <span style={{ fontWeight: 900, ...gText, fontSize: 16 }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", fontWeight: 700, marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          Ce qui est disponible maintenant
          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)", display: "block" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {[
            { icon: "🏫", title: "Gestion classes & élèves", desc: "Organisez vos groupes, suivez chaque profil individuellement." },
            { icon: "📊", title: "Évaluations par compétences", desc: "Échelle NI / I / S / B / TB, alignée sur les attendus FWB." },
            { icon: "📈", title: "Tableaux de bord enseignant", desc: "Vue immédiate sur les lacunes par élève et par compétence." },
            { icon: "✨", title: "Remédiations générées par IA", desc: "Activités adaptées au profil de l'élève, prêtes à utiliser." },
            { icon: "📄", title: "Rapports PDF administratifs", desc: "Preuves de remédiation prêtes à remettre à la direction." },
            { icon: "🎙️", title: "Module vocal", desc: "Entraînement à la prononciation pour les cours de langues. (Bientôt)", badge: true },
          ].map(f => (
            <div key={f.title} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "18px 20px" }}>
              <span style={{ fontSize: 20, marginBottom: 10, display: "block" }}>{f.icon}</span>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                {f.title}
                {f.badge && <span style={{ marginLeft: 8, fontSize: 11, color: ACCENT, fontWeight: 700 }}>Bientôt</span>}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", fontWeight: 700, marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          Essayez sans inscription
          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)", display: "block" }} />
        </div>
        <div style={{
          background: "linear-gradient(135deg, rgba(255,59,48,0.08), rgba(10,132,255,0.08))",
          border: "1px solid rgba(10,132,255,0.2)", borderRadius: 20, padding: "28px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20,
        }}>
          <div>
            <div style={{ display: "inline-block", background: "rgba(10,132,255,0.15)", border: "1px solid rgba(10,132,255,0.3)", borderRadius: 999, padding: "3px 12px", color: ACCENT, fontSize: 11, fontWeight: 800, marginBottom: 8 }}>🎮 Démo instantanée</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Testez Klasbook en 30 secondes</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 380 }}>Accès immédiat à un compte démo complet — classes, élèves, évaluations, remédiations. Aucune inscription, aucune carte.</div>
          </div>
          <Link href="/api/demo?role=prof" style={{
            padding: "12px 22px", borderRadius: 14, background: G, color: "#fff",
            fontWeight: 800, fontSize: 14, textDecoration: "none",
            boxShadow: "0 12px 28px rgba(10,132,255,0.3)", whiteSpace: "nowrap",
          }}>
            Voir la démo prof →
          </Link>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", fontWeight: 700, marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          Tarifs
          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)", display: "block" }} />
        </div>
        <div style={{ background: "rgba(10,132,255,0.06)", border: "1.5px solid rgba(10,132,255,0.25)", borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 12 }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: G, borderRadius: "20px 20px 0 0" }} />
          <div>
            <div style={{ display: "inline-block", background: "rgba(10,132,255,0.15)", border: "1px solid rgba(10,132,255,0.3)", borderRadius: 999, padding: "3px 12px", color: ACCENT, fontSize: 11, fontWeight: 800, marginBottom: 8 }}>⭐ Recommandé</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Pack Prof Individuel</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>Accès complet · Remédiations IA illimitées<br />Rapports PDF · Portail parents · Historique complet</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: "3rem", fontWeight: 900, letterSpacing: "-2px", display: "block", lineHeight: 1, marginBottom: 4 }}>21€</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>/mois · ou 189€/an</span>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Pack École</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Jusqu'à 20 profs · Portail direction · Formation incluse · DPA RGPD</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-1px", display: "block", lineHeight: 1 }}>249€</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>/mois · ou 1 990€/an</span>
          </div>
        </div>
      </section>

      {/* GARANTIE */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 20, padding: "24px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🛡️</div>
          <strong style={{ display: "block", fontWeight: 800, fontSize: 15, marginBottom: 8 }}>14 jours gratuits · Satisfait ou remboursé 30 jours</strong>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>Essayez Klasbook Pro sans carte bancaire. Remboursement intégral dans les 30 premiers jours après souscription, sans question.</p>
        </div>
      </div>

      {/* CTA FINAL */}
      <div style={{ textAlign: "center", padding: "60px 24px 80px", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 12 }}>
          Prêt à gagner du temps <span style={gText}>chaque semaine</span> ?
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 32 }}>Rejoignez les profs FWB qui utilisent déjà Klasbook.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login?tab=register" style={{ display: "inline-block", padding: "14px 36px", borderRadius: 14, background: G, color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
            Commencer — c'est gratuit ✨
          </Link>
          <a href="mailto:mamuscia.pasquale.85@gmail.com" style={{ display: "inline-block", padding: "14px 28px", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 15, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", textDecoration: "none" }}>
            Parler à un humain
          </a>
        </div>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 16 }}>Aucune carte bancaire pour l'essai · Données RGPD hébergées en Europe</div>
      </div>

      {/* FOOTER */}
      <footer style={{ padding: "20px 40px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "center", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        {[
          { label: "klasbook.be", href: "/" },
          { label: "Confidentialité", href: "/vie-privee" },
          { label: "CGU", href: "/cgu" },
          { label: "Contact", href: "mailto:mamuscia.pasquale.85@gmail.com" },
        ].map(l => (
          <a key={l.href} href={l.href} style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textDecoration: "none" }}>{l.label}</a>
        ))}
        <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>© 2026 Klasbook</span>
      </footer>
    </div>
  );
}
