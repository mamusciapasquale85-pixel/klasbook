"use client";

import { useState } from "react";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";
const ACCENT = "#0A84FF";
const DARK = "#0f172a";

type Plan = "free" | "pro" | "ecole";
type Billing = "monthly" | "annual";

const PLANS = {
  free: {
    name: "Gratuit",
    tagline: "Pour découvrir Klasbook",
    price: { monthly: 0, annual: 0 },
    color: "#64748b",
    bg: "#f8fafc",
    border: "#e2e8f0",
    features: [
      { label: "10 exercices IA / mois", ok: true },
      { label: "1 classe", ok: true },
      { label: "Génération 7 matières FWB", ok: true },
      { label: "Export PDF exercice", ok: true },
      { label: "Inspecteur FWB (5 msg/jour)", ok: true },
      { label: "Page élève (partage par lien)", ok: false },
      { label: "Correction IA des copies", ok: false },
      { label: "Bulletins & compétences FWB", ok: false },
      { label: "Portail parents", ok: false },
      { label: "Exercices illimités", ok: false },
    ],
    cta: "Commencer gratuitement",
    ctaHref: "/register",
    highlight: false,
  },
  pro: {
    name: "Pro Prof",
    tagline: "Pour un professeur actif",
    price: { monthly: 21, annual: 189 },
    priceNote: { monthly: "/mois · sans engagement", annual: "/an — économise 63€" },
    color: ACCENT,
    bg: "#eff6ff",
    border: ACCENT,
    features: [
      { label: "Exercices IA illimités", ok: true },
      { label: "Toutes les classes", ok: true },
      { label: "7 matières + référentiels IFPC", ok: true },
      { label: "Export PDF avec canevas école", ok: true },
      { label: "Inspecteur FWB illimité", ok: true },
      { label: "Page élève + partage par lien", ok: true },
      { label: "Correction IA des copies", ok: true },
      { label: "Bulletins & compétences FWB", ok: true },
      { label: "Portail parents intégré", ok: true },
      { label: "Historique complet", ok: true },
    ],
    cta: "Essai gratuit 14 jours",
    ctaHref: "/register?plan=pro",
    highlight: true,
  },
  ecole: {
    name: "École",
    tagline: "Pour toute l'équipe enseignante",
    price: { monthly: 249, annual: 1990 },
    priceNote: { monthly: "/mois · jusqu'à 10 profs", annual: "/an — économise 998€" },
    color: "#7c3aed",
    bg: "#faf5ff",
    border: "#7c3aed",
    features: [
      { label: "Tout du plan Pro", ok: true },
      { label: "Jusqu'à 20 professeurs", ok: true },
      { label: "Portail direction centralisé", ok: true },
      { label: "Statistiques par établissement", ok: true },
      { label: "Import CSV élèves/classes", ok: true },
      { label: "Onboarding personnalisé", ok: true },
      { label: "Support prioritaire (email + tel)", ok: true },
      { label: "DPA (accord traitement données)", ok: true },
      { label: "Formation équipe (2h incluses)", ok: true },
      { label: "Facturation à l'établissement", ok: true },
    ],
    cta: "Demander une démo",
    ctaHref: "/contact?plan=ecole",
    highlight: false,
  },
};

const FAQS = [
  {
    q: "Est-ce que Klasbook est conforme aux référentiels FWB ?",
    a: "Oui. Tous les exercices générés intègrent automatiquement les référentiels officiels IFPC de la Fédération Wallonie-Bruxelles pour la matière et le niveau concernés. Les attendus du Tronc Commun (1S–6S) et du CECRL (A1–B2) sont respectés à chaque génération.",
  },
  {
    q: "Mes données et celles de mes élèves sont-elles en sécurité ?",
    a: "Klasbook est hébergé en Europe (Supabase EU). Les données sont chiffrées en transit et au repos. Pour les établissements scolaires (plan École), un DPA (accord de traitement des données) conforme RGPD est fourni et signable.",
  },
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui, sans engagement. Annule quand tu veux depuis ton profil. Avec le plan annuel, tu bénéficies d'un remboursement au prorata si tu annules dans les 30 premiers jours.",
  },
  {
    q: "L'essai gratuit 14 jours nécessite-t-il une carte bancaire ?",
    a: "Non. Tu crées un compte, tu utilises Klasbook Pro pendant 14 jours, et ta carte n'est demandée qu'au moment où tu choisis de continuer.",
  },
  {
    q: "Comment fonctionne le plan École pour plusieurs profs ?",
    a: "La direction crée le compte École, invite les professeurs par email, et chacun accède à son profil individuel. La direction visualise l'activité globale depuis le portail direction. Jusqu'à 10 profs sont inclus ; au-delà, contacte-nous pour le Pack Pilote.",
  },
  {
    q: "C'est quoi le Pack Pilote École ?",
    a: "C'est une formule 3 mois à 490€ pour 5 profs, idéale pour tester Klasbook en équipe avant de s'engager sur l'année. Tu bénéficies d'un accompagnement personnalisé et d'un rapport d'impact à l'issue du pilote. Contacte-nous à contact@klasbook.be.",
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ minHeight: "100vh", background: "#06090f", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Nav */}
      <nav style={{
        padding: "16px 40px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontSize: 16 }}>✦</span>
          </div>
          <span style={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>Klasbook</span>
        </a>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/login" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 14 }}>Connexion</a>
          <a href="/register" style={{
            padding: "8px 18px", borderRadius: 10, background: GRADIENT,
            color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700,
          }}>Essai gratuit</a>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "72px 24px 48px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(10,132,255,0.12)", border: "1px solid rgba(10,132,255,0.25)",
          borderRadius: 20, padding: "5px 14px",
          color: ACCENT, fontSize: 12, fontWeight: 700, marginBottom: 20,
        }}>
          🇧🇪 Conçu pour la Fédération Wallonie-Bruxelles
        </div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 16 }}>
          Simple, transparent,<br />
          <span style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            taillé pour tes besoins
          </span>
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 16, maxWidth: 480, margin: "0 auto 24px" }}>
          Commence gratuitement. Passe au Pro quand tu veux. Aucun engagement.
        </p>

        {/* Early adopter banner */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          background: "linear-gradient(135deg, rgba(255,59,48,0.12), rgba(10,132,255,0.10))",
          border: "1px solid rgba(255,59,48,0.35)", borderRadius: 12,
          padding: "12px 20px", marginBottom: 28, justifyContent: "center",
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#FF3B30" }}>🔥 30 places Early Adopter</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Pack Pro à <strong style={{ color: "#fff" }}>149€/an</strong> au lieu de 189€/an</span>
          <a href="/register?plan=early-adopter" style={{
            background: "linear-gradient(135deg, #FF3B30, #0A84FF)", color: "#fff",
            padding: "7px 16px", borderRadius: 8, fontWeight: 700, fontSize: 12,
            textDecoration: "none", whiteSpace: "nowrap",
          }}>Réserver →</a>
        </div>

        {/* Toggle billing */}
        <div style={{
          display: "inline-flex", background: "rgba(255,255,255,0.07)",
          borderRadius: 12, padding: 4, gap: 4,
        }}>
          {(["monthly", "annual"] as Billing[]).map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              style={{
                padding: "8px 20px", borderRadius: 9, border: "none",
                background: billing === b ? "#fff" : "transparent",
                color: billing === b ? DARK : "rgba(255,255,255,0.6)",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {b === "monthly" ? "Mensuel" : "Annuel"}
              {b === "annual" && (
                <span style={{
                  marginLeft: 8, fontSize: 10, background: "#10b981",
                  color: "#fff", borderRadius: 8, padding: "2px 6px",
                }}>
                  −25%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 20, alignItems: "start",
      }}>
        {(Object.keys(PLANS) as Plan[]).map(planKey => {
          const plan = PLANS[planKey];
          const price = plan.price[billing];
          return (
            <div
              key={planKey}
              style={{
                background: plan.highlight ? "rgba(10,132,255,0.06)" : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${plan.highlight ? plan.border : "rgba(255,255,255,0.1)"}`,
                borderRadius: 20, padding: "28px 24px",
                position: "relative", overflow: "hidden",
                transform: plan.highlight ? "scale(1.02)" : "scale(1)",
                boxShadow: plan.highlight ? "0 0 40px rgba(10,132,255,0.15)" : "none",
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0,
                  background: GRADIENT, height: 3, borderRadius: "20px 20px 0 0",
                }} />
              )}
              {plan.highlight && (
                <div style={{
                  display: "inline-block", marginBottom: 12,
                  background: "rgba(10,132,255,0.15)", border: "1px solid rgba(10,132,255,0.3)",
                  borderRadius: 20, padding: "3px 12px",
                  color: ACCENT, fontSize: 11, fontWeight: 800,
                }}>
                  ⭐ Recommandé
                </div>
              )}
              <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>{plan.name}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 3 }}>{plan.tagline}</div>

              <div style={{ margin: "20px 0 24px" }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: "#fff" }}>
                  {price === 0 ? "Gratuit" : `${price}€`}
                </span>
                {price > 0 && (
                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginLeft: 6 }}>
                    {"priceNote" in plan ? (plan as typeof PLANS.pro).priceNote[billing] : ""}
                  </span>
                )}
              </div>

              <a
                href={plan.ctaHref}
                style={{
                  display: "block", textAlign: "center",
                  padding: "11px 0", borderRadius: 11,
                  background: plan.highlight ? GRADIENT : "rgba(255,255,255,0.1)",
                  border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.2)",
                  color: "#fff", fontWeight: 800, fontSize: 14,
                  textDecoration: "none", marginBottom: 24,
                  transition: "opacity 0.2s",
                }}
              >
                {plan.cta}
              </a>

              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 5,
                      background: f.ok ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, fontSize: 11,
                    }}>
                      {f.ok ? "✓" : "–"}
                    </span>
                    <span style={{ color: f.ok ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}>
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Garantie */}
      <div style={{
        maxWidth: 700, margin: "0 auto 80px",
        background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
        borderRadius: 18, padding: "24px 32px", textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🛡️</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", marginBottom: 8 }}>
          14 jours gratuits — satisfait ou remboursé
        </div>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.7 }}>
          Essaie Klasbook Pro 14 jours sans carte bancaire. Si Klasbook ne répond pas à tes attentes dans les 30 premiers jours après souscription, on te rembourse intégralement. Sans question, sans tracas.
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 720, margin: "0 auto 100px", padding: "0 24px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 22, textAlign: "center", marginBottom: 32 }}>
          Questions fréquentes
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${openFaq === i ? "rgba(10,132,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 14, overflow: "hidden",
              }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%", padding: "16px 20px",
                  background: "transparent", border: "none",
                  color: "#fff", fontWeight: 700, fontSize: 14,
                  textAlign: "left", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                }}
              >
                {faq.q}
                <span style={{
                  fontSize: 18, color: openFaq === i ? ACCENT : "rgba(255,255,255,0.4)",
                  transition: "transform 0.2s",
                  transform: openFaq === i ? "rotate(45deg)" : "none",
                  flexShrink: 0,
                }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{
                  padding: "0 20px 16px", color: "rgba(255,255,255,0.65)",
                  fontSize: 13, lineHeight: 1.75,
                }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA final */}
      <div style={{
        textAlign: "center", padding: "60px 24px 80px",
        background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.07)",
      }}>
        <h2 style={{ fontWeight: 900, fontSize: 22, marginBottom: 12 }}>
          Prêt à gagner du temps chaque semaine ?
        </h2>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 28 }}>
          Rejoins les profs FWB qui utilisent déjà Klasbook.
        </p>
        <a
          href="/register"
          style={{
            display: "inline-block", padding: "14px 36px",
            borderRadius: 14, background: GRADIENT,
            color: "#fff", fontWeight: 800, fontSize: 15,
            textDecoration: "none",
          }}
        >
          Commencer — c'est gratuit ✨
        </a>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 12 }}>
          Aucune carte bancaire requise pour l'essai.
        </div>
      </div>

      {/* Footer links */}
      <footer style={{
        padding: "20px 40px", borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap",
      }}>
        {[
          { label: "Politique de confidentialité", href: "/vie-privee" },
          { label: "CGU", href: "/cgu" },
          { label: "Contact", href: "/contact" },
          { label: "klasbook.be", href: "/" },
        ].map(link => (
          <a
            key={link.href}
            href={link.href}
            style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textDecoration: "none" }}
          >
            {link.label}
          </a>
        ))}
      </footer>
    </div>
  );
}
