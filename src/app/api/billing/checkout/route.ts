import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ─── Config Stripe ──────────────────────────────────────────────────────────
// Variables d'environnement requises dans .env.local :
//   STRIPE_SECRET_KEY=sk_live_...  (ou sk_test_... pour les tests)
//   NEXT_PUBLIC_APP_URL=https://klasbook.be

export const runtime = "nodejs";

// Prix Stripe — à remplacer par vos vrais Price IDs depuis le dashboard Stripe
// Stripe Dashboard → Products → créer les produits/prix puis copier les IDs ici
const PRICE_IDS: Record<string, Record<string, string>> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "price_pro_monthly_placeholder",
    annual:  process.env.STRIPE_PRICE_PRO_ANNUAL  ?? "price_pro_annual_placeholder",
  },
  ecole: {
    monthly: process.env.STRIPE_PRICE_ECOLE_MONTHLY ?? "price_ecole_monthly_placeholder",
    annual:  process.env.STRIPE_PRICE_ECOLE_ANNUAL  ?? "price_ecole_annual_placeholder",
  },
};

type CheckoutRequest = {
  plan: "pro" | "ecole";
  billing: "monthly" | "annual";
};

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY manquante" }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-03-25.dahlia" });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = (await req.json()) as CheckoutRequest;
    const { plan, billing } = body;

    if (!PRICE_IDS[plan]?.[billing]) {
      return NextResponse.json({ error: "Plan ou facturation invalide" }, { status: 400 });
    }

    // Récupérer ou créer le customer Stripe
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      // Sauvegarder l'ID customer
      await supabase
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://klasbook.be";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_IDS[plan][billing], quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgrade=success`,
      cancel_url: `${appUrl}/pricing?upgrade=cancelled`,
      locale: "fr",
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
        },
        trial_period_days: 14, // 14 jours d'essai gratuit (affiché sur la page pricing)
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
