"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { gsap } from "gsap";

function MobileSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sheetRef.current || !overlayRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(sheetRef.current, { y: "100%" }, { y: 0, duration: 0.3, ease: "power3.out" });
  }, []);
  function handleClose() {
    if (!sheetRef.current || !overlayRef.current) { onClose(); return; }
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(sheetRef.current, { y: "100%", duration: 0.25, ease: "power2.in", onComplete: onClose });
  }
  return (
    <>
      <div ref={overlayRef} onClick={handleClose}
        style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(15,23,42,0.4)" }} />
      <div ref={sheetRef} style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301,
        background: "#fff", borderRadius: "20px 20px 0 0",
        paddingBottom: "env(safe-area-inset-bottom, 16px)",
        boxShadow: "0 -8px 40px rgba(15,23,42,0.18)",
      }}>
        {children}
      </div>
    </>
  );
}

type NavItem = { label: string; icon: string; href: string };

// Tous les items dans un seul tableau — plus de "⋯ Plus"
const NAV_ITEMS_BASE: NavItem[] = [
  { label: "Accueil",        icon: "🏠", href: "/dashboard" },
  { label: "Classes",        icon: "👥", href: "/classe" },
  { label: "Agenda",         icon: "📅", href: "/agenda" },
  { label: "Évaluations",    icon: "📝", href: "/evaluations" },
  { label: "Résultats",      icon: "📊", href: "/resultats" },
  { label: "Remédiations",   icon: "🩺", href: "/remediations" },
  { label: "Bulletins",      icon: "📄", href: "/bulletins" },
  { label: "Apprentissages", icon: "🎯", href: "/competences" },
  { label: "Outil vocal",    icon: "🎙️", href: "/vocal" },
  { label: "Générateur IA",  icon: "✨", href: "/generateur" },
  { label: "Historique",     icon: "📚", href: "/historique" },
  { label: "Outils",         icon: "🎲", href: "/outils" },
];

// Items épinglés dans la barre bas mobile (les 5 plus utilisés)
const MOBILE_PINNED_HREFS = ["/dashboard", "/evaluations", "/resultats", "/bulletins", "/vocal"];

const LS_KEY = "klasbook_apprentissage_label";

export default function ProfShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [apprentissageLabel, setApprentissageLabel] = useState<string>("Apprentissages");
  const [isMobile, setIsMobile] = useState(false);
  const [userInitial, setUserInitial] = useState("?");
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.from("user_profiles").select("full_name").then(({ data }) => {
      const name = (data?.[0] as { full_name?: string } | undefined)?.full_name ?? "";
      const clean = name.replace(/\./g, " ").trim();
      const initial = clean.split(/\s+/)[0]?.[0]?.toUpperCase() ?? "?";
      setUserInitial(initial);
    });
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) setApprentissageLabel(saved);
    const handler = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue) setApprentissageLabel(e.newValue);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const ALL_ITEMS: NavItem[] = NAV_ITEMS_BASE.map(item =>
    item.href === "/competences" ? { ...item, label: apprentissageLabel } : item
  );

  // Items épinglés pour la barre bas mobile
  const pinnedItems = MOBILE_PINNED_HREFS
    .map(href => ALL_ITEMS.find(i => i.href === href))
    .filter((i): i is NavItem => Boolean(i));

  // Items dans le drawer "Plus"
  const drawerItems = ALL_ITEMS.filter(i => !MOBILE_PINNED_HREFS.includes(i.href));

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  // Ferme le drawer si on navigue
  useEffect(() => { setMobileSheetOpen(false); }, [pathname]);

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname?.startsWith(href));
  }

  const currentPage = ALL_ITEMS.find(i => isActive(i.href));

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FC", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 1px 0 rgba(15,23,42,0.06)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "0 16px" : "0 24px" }}>

          {/* Ligne 1 : Logo + Avatar */}
          <div style={{ height: isMobile ? 52 : 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(10,132,255,0.3)",
              }}>
                <span style={{ fontSize: 16, color: "#fff" }}>✦</span>
              </div>
              <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em" }}>
                Klasbook
              </span>
            </a>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isMobile && (
                <a href="/auth/logout" style={{
                  padding: "6px 10px", borderRadius: 8, textDecoration: "none",
                  fontSize: "0.82rem", fontWeight: 500, color: "#ef4444",
                }}>
                  🚪 Déconnexion
                </a>
              )}
              <div ref={avatarRef} style={{ position: "relative" }}>
                <button onClick={() => setMenuOpen(v => !v)} style={{
                  width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, color: "#fff", fontSize: 14,
                }}>{userInitial}</button>
                {menuOpen && (
                  <div style={{
                    position: "absolute", top: 44, right: 0, zIndex: 200,
                    background: "#fff", borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)",
                    boxShadow: "0 8px 32px rgba(15,23,42,0.16)", padding: 6, minWidth: 180,
                  }}>
                    <div style={{ padding: "8px 12px", fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>LAB Marie Curie</div>
                    <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />
                    <a href="/import" onClick={() => setMenuOpen(false)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
                      borderRadius: 8, textDecoration: "none", fontSize: "0.875rem", fontWeight: 500, color: "#334155",
                    }}>📥 Import</a>
                    <a href="/auth/logout" style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
                      borderRadius: 8, fontSize: "0.875rem", fontWeight: 600, color: "#ef4444",
                      textDecoration: "none",
                    }}>🚪 Se déconnecter</a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ligne 2 : nav desktop (tous les items, scroll horizontal si besoin) */}
          {!isMobile && (
            <nav style={{
              display: "flex", alignItems: "center", gap: 1,
              paddingBottom: 6, overflowX: "auto",
              scrollbarWidth: "none",
            }}>
              {ALL_ITEMS.map(item => {
                const active = isActive(item.href);
                return (
                  <a key={item.href} href={item.href} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 8px", borderRadius: 8,
                    textDecoration: "none", fontSize: "0.78rem",
                    fontWeight: active ? 700 : 500,
                    color: active ? "#0f172a" : "#64748b",
                    background: active ? "rgba(15,23,42,0.07)" : "transparent",
                    whiteSpace: "nowrap", flexShrink: 0,
                    borderBottom: active ? "2px solid #0A84FF" : "2px solid transparent",
                    transition: "all 0.1s",
                  }}>
                    <span style={{ fontSize: 12 }}>{item.icon}</span>
                    {item.label}
                  </a>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* Fil d'ariane (masqué sur l'accueil car redondant) */}
      {currentPage && currentPage.href !== "/dashboard" && (
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "10px 16px 0" : "14px 24px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Klasbook</span>
          <span style={{ fontSize: 12, color: "#cbd5e1" }}>›</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{currentPage.icon} {currentPage.label}</span>
        </div>
      )}

      {/* Contenu principal */}
      <main style={{
        maxWidth: 1280, margin: "0 auto",
        padding: isMobile ? "14px 12px 96px" : "20px 24px 48px",
      }}>
        {children}
      </main>

      {/* ── BARRE BAS MOBILE (iOS style) ── */}
      {isMobile && (
        <>
          <nav style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(15,23,42,0.1)",
            display: "flex", alignItems: "stretch",
            paddingBottom: "env(safe-area-inset-bottom, 8px)",
          }}>
            {pinnedItems.map(item => {
              const active = isActive(item.href);
              return (
                <a key={item.href} href={item.href} style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 3, padding: "8px 4px",
                  textDecoration: "none",
                  color: active ? "#0A84FF" : "#94a3b8",
                  transition: "color 0.15s",
                }}>
                  <span style={{
                    fontSize: 22,
                    filter: active ? "none" : "grayscale(0.3) opacity(0.7)",
                  }}>{item.icon}</span>
                  <span style={{
                    fontSize: 10, fontWeight: active ? 700 : 500,
                    letterSpacing: "-0.01em", whiteSpace: "nowrap",
                  }}>{item.label}</span>
                  {active && (
                    <span style={{
                      position: "absolute", top: 0,
                      width: 32, height: 2, borderRadius: 1,
                      background: "#0A84FF",
                    }} />
                  )}
                </a>
              );
            })}

            {/* Bouton "Plus" */}
            <button onClick={() => setMobileSheetOpen(true)} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 3, padding: "8px 4px",
              background: "none", border: "none", cursor: "pointer",
              color: "#94a3b8",
            }}>
              <span style={{ fontSize: 22 }}>☰</span>
              <span style={{ fontSize: 10, fontWeight: 500 }}>Plus</span>
            </button>
          </nav>

          {/* ── DRAWER "PLUS" (bottom sheet) ── */}
          {mobileSheetOpen && (
            <MobileSheet onClose={() => setMobileSheetOpen(false)}>
                {/* Handle */}
                <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e2e8f0" }} />
                </div>
                <div style={{ padding: "4px 12px 8px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Navigation
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: "0 12px 12px" }}>
                  {drawerItems.map(item => {
                    const active = isActive(item.href);
                    return (
                      <a key={item.href} href={item.href} style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        gap: 6, padding: "14px 8px", borderRadius: 14,
                        textDecoration: "none",
                        background: active ? "#eff6ff" : "#f8fafc",
                        border: active ? "1.5px solid #bfdbfe" : "1.5px solid transparent",
                      }}>
                        <span style={{ fontSize: 26 }}>{item.icon}</span>
                        <span style={{
                          fontSize: 11, fontWeight: active ? 700 : 500,
                          color: active ? "#0A84FF" : "#475569",
                          textAlign: "center", lineHeight: 1.2,
                        }}>{item.label}</span>
                      </a>
                    );
                  })}
                </div>
                {/* Déconnexion */}
                <div style={{ margin: "0 12px 12px", borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                  <a href="/auth/logout" style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "13px 16px", borderRadius: 12,
                    textDecoration: "none", fontSize: "0.9rem",
                    fontWeight: 600, color: "#ef4444",
                    background: "#fff5f5",
                  }}>🚪 Se déconnecter</a>
                </div>
            </MobileSheet>
          )}
        </>
      )}
    </div>
  );
}
