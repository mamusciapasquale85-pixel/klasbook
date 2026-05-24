import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a56db",
};

export const metadata: Metadata = {
  title: "Klasbook — La gestion de classe simplifiée pour la FWB",
  description: "Génération d'exercices IA, bulletins, compétences FWB, portails parents — la plateforme pédagogique dédiée aux enseignants de la Fédération Wallonie-Bruxelles.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://klasbook.be"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Klasbook",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Klasbook",
    description: "La plateforme pédagogique IA pour les enseignants FWB",
    siteName: "Klasbook",
    locale: "fr_BE",
    type: "website",
  },
};

// PostHog analytics
// Variable d'environnement requise : NEXT_PUBLIC_POSTHOG_KEY=phc_...
// À obtenir sur : https://eu.posthog.com (région EU pour conformité RGPD)
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${dmSans.variable} antialiased`}>
        {children}

        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              }
            `,
          }}
        />

        {/* PostHog — analytics produit (chargé uniquement si la clé est configurée) */}
        {POSTHOG_KEY && (
          <Script
            id="posthog-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+" people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||(window.posthog=[]));
                posthog.init("${POSTHOG_KEY}", {
                  api_host: "${POSTHOG_HOST}",
                  person_profiles: "identified_only",
                  capture_pageview: true,
                  capture_pageleave: true,
                  autocapture: false,
                  session_recording: { maskAllInputs: true },
                });
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
