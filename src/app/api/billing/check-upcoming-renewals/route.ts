import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendTrialExpirationWarningEmail } from "@/lib/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

async function getUserData(userId: string): Promise<{ email: string; firstName: string } | null> {
  const supabase = getSupabaseAdmin();

  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authUser?.user?.email) {
    console.error(`[Renewal Check] Auth user ${userId} introuvable:`, authError);
    return null;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const fullName = (profile as { full_name?: string } | null)?.full_name ?? "";
  const firstName = fullName.split(" ")[0] || "Utilisateur";

  return { email: authUser.user.email, firstName };
}

function planFromMetadata(subscription: Stripe.Subscription): "pro" | "ecole" {
  return subscription.metadata?.plan === "ecole" ? "ecole" : "pro";
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-03-25.dahlia" });

  const supabase = getSupabaseAdmin();

  let processedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  const failedEmails: Array<{ email: string; reason: string }> = [];

  try {
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: users, error } = await supabase
      .from("user_profiles")
      .select("id, plan, plan_expires_at, stripe_customer_id")
      .eq("plan", "pro")
      .eq("renewal_warning_sent", false)
      .gte("plan_expires_at", now.toISOString())
      .lte("plan_expires_at", in48Hours.toISOString());

    if (error) {
      console.error("[Renewal Check] Erreur requête utilisateurs:", error);
      return NextResponse.json(
        { error: "Erreur requête base de données" },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      console.log("[Renewal Check] Aucun utilisateur à traiter");
      return NextResponse.json({
        message: "Aucun utilisateur nécessitant une relance",
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        failedEmails: [],
      });
    }

    for (const user of users) {
      processedCount++;

      // Récupérer email + prénom via auth.users dès le début
      const userData = await getUserData(user.id);
      const userEmail = userData?.email ?? `user:${user.id}`;

      if (!user.stripe_customer_id) {
        failedEmails.push({ email: userEmail, reason: "stripe_customer_id manquant" });
        failedCount++;
        continue;
      }

      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          limit: 1,
          status: "active",
        });

        if (!subscriptions.data || subscriptions.data.length === 0) {
          failedEmails.push({ email: userEmail, reason: "Abonnement actif non trouvé" });
          failedCount++;
          continue;
        }

        const subscription = subscriptions.data[0];
        const chargeAmount = (subscription.items.data[0]?.price.unit_amount ?? 0) / 100;
        const chargeDate = new Date(user.plan_expires_at!).toISOString().split("T")[0];
        const plan = planFromMetadata(subscription);

        if (!userData) {
          failedEmails.push({ email: userEmail, reason: "Données utilisateur non trouvées" });
          failedCount++;
          continue;
        }

        await sendTrialExpirationWarningEmail({
          to: userData.email,
          firstName: userData.firstName,
          plan,
          amount: chargeAmount,
          chargeDate,
        });

        await supabase
          .from("user_profiles")
          .update({ renewal_warning_sent: true })
          .eq("id", user.id);

        console.log(`[Renewal Check] Email relance envoyé : user=${user.id} email=${userData.email}`);
        successCount++;
      } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : String(emailError);
        console.error(`[Renewal Check] Erreur traitement user=${user.id}:`, errorMsg);
        failedEmails.push({ email: userEmail, reason: errorMsg });
        failedCount++;
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Renewal Check] Erreur générale:", msg);
    return NextResponse.json(
      { error: `Erreur: ${msg}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: `Traitement terminé: ${successCount}/${processedCount} emails envoyés`,
    processedCount,
    successCount,
    failedCount,
    failedEmails,
  });
}
