import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendTrialInitiationEmail, sendTrialExpirationWarningEmail, sendCancellationConfirmationEmail } from "@/lib/emails";

// ─── Webhook Stripe ─────────────────────────────────────────────────────────
// Variable d'environnement requise : STRIPE_WEBHOOK_SECRET=whsec_...
// À récupérer dans Stripe Dashboard → Developers → Webhooks → votre endpoint
//
// URL du webhook à configurer dans Stripe : https://klasbook.be/api/billing/webhook
// Événements à écouter :
//   - checkout.session.completed
//   - customer.subscription.updated
//   - customer.subscription.deleted

export const runtime = "nodejs";

// Client Supabase avec service role (pas de cookie — contexte serveur pur)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

function planFromMetadata(subscription: Stripe.Subscription): "pro" | "ecole" {
  return subscription.metadata?.plan === "ecole" ? "ecole" : "pro";
}

async function getUserData(userId: string): Promise<{ email: string; firstName: string } | null> {
  const supabase = getSupabaseAdmin();

  // email → auth.users (user_profiles n'a pas de colonne email)
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authUser?.user?.email) {
    console.error(`[getUserData] Auth user ${userId} introuvable:`, authError);
    return null;
  }

  // prénom → user_profiles.full_name (première partie avant l'espace)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const fullName = (profile as { full_name?: string } | null)?.full_name ?? "";
  const firstName = fullName.split(" ")[0] || "Utilisateur";

  return { email: authUser.user.email, firstName };
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET manquant" }, { status: 500 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-03-25.dahlia" });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signature invalide";
    console.error("[Stripe Webhook] Erreur signature:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {

      // ─── Paiement réussi / abonnement activé ──────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        ) as unknown as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        const plan = planFromMetadata(subscription);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expiresAt = new Date((subscription as any).current_period_end * 1000).toISOString();

        await supabase
          .from("user_profiles")
          .update({
            plan,
            plan_expires_at: expiresAt,
            stripe_customer_id: session.customer as string,
          })
          .eq("id", userId);

        console.log(`[Stripe] Abonnement activé : user=${userId} plan=${plan}`);

        // Get user data and send trial initiation email
        const userData = await getUserData(userId);
        if (userData) {
          try {
            await sendTrialInitiationEmail({
              to: userData.email,
              firstName: userData.firstName,
              plan,
              trialEndsAt: expiresAt,
            });
            console.log(`[Stripe] Email initiation essai envoyé : user=${userId}`);
          } catch (emailError) {
            console.error(`[Stripe] Erreur envoi email initiation : user=${userId}`, emailError);
          }
        }
        break;
      }

      // ─── Renouvellement / modification ────────────────────────────────────
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        const isActive = ["active", "trialing"].includes(subscription.status);
        const plan = isActive ? planFromMetadata(subscription) : "free";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expiresAt = isActive
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null;

        await supabase
          .from("user_profiles")
          .update({ plan, plan_expires_at: expiresAt })
          .eq("id", userId);

        console.log(`[Stripe] Abonnement mis à jour : user=${userId} status=${subscription.status} plan=${plan}`);
        break;
      }

      // ─── Résiliation ───────────────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        await supabase
          .from("user_profiles")
          .update({ plan: "free", plan_expires_at: null })
          .eq("id", userId);

        console.log(`[Stripe] Abonnement résilié : user=${userId}`);

        // Capture plan and access end date before setting to free
        const cancelledPlan = planFromMetadata(subscription);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accessUntil = new Date((subscription as any).current_period_end * 1000).toISOString();

        // Get user data and send cancellation email
        const userData = await getUserData(userId);
        if (userData) {
          try {
            await sendCancellationConfirmationEmail({
              to: userData.email,
              firstName: userData.firstName,
              plan: cancelledPlan,
              accessUntil,
            });
            console.log(`[Stripe] Email confirmation annulation envoyé : user=${userId}`);
          } catch (emailError) {
            console.error(`[Stripe] Erreur envoi email annulation : user=${userId}`, emailError);
          }
        }
        break;
      }

      default:
        // Événement non géré — on ignore silencieusement
        break;
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Stripe Webhook] Erreur traitement:", msg);
    // On renvoie 200 quand même pour que Stripe ne réessaie pas en boucle
  }

  return NextResponse.json({ received: true });
}
