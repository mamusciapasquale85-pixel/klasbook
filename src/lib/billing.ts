// ─── Logique freemium ────────────────────────────────────────────────────────
// Utilisé côté serveur pour vérifier les quotas et le plan de l'utilisateur.

import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_PLAN_MONTHLY_LIMIT = 10;       // exercices/mois en plan gratuit
export const FREE_PLAN_MONTHLY_CORRECTIONS = 20; // corrections/mois en plan gratuit
export const FREE_PLAN_MONTHLY_REMEDIATIONS = 5; // remediations/mois en plan gratuit

type UserPlan = {
  plan: string;
  plan_expires_at: string | null;
};

type UsageColumn = "nb_exercices" | "nb_corrections" | "nb_remediations";

/**
 * Retourne le plan actif de l'utilisateur.
 * Si l'abonnement a expiré, on retourne "free".
 */
export async function getUserPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("user_profiles")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .single();

  if (!data) return "free";

  const { plan, plan_expires_at } = data as UserPlan;

  // Si le plan a une date d'expiration et qu'elle est passée → free
  if (plan !== "free" && plan_expires_at) {
    if (new Date(plan_expires_at) < new Date()) return "free";
  }

  return plan ?? "free";
}

async function checkAndIncrement(
  supabase: SupabaseClient,
  userId: string,
  column: UsageColumn,
  limit: number
): Promise<{ allowed: boolean; used?: number; limit?: number }> {
  const plan = await getUserPlan(supabase, userId);
  if (plan !== "free") return { allowed: true };

  const mois = new Date().toISOString().slice(0, 7);

  const { data: usage } = await supabase
    .from("usage_mensuel")
    .select(column)
    .eq("user_id", userId)
    .eq("mois", mois)
    .single();

  const current = (usage as Record<string, number> | null)?.[column] ?? 0;

  if (current >= limit) {
    return { allowed: false, used: current, limit };
  }

  await supabase
    .from("usage_mensuel")
    .upsert(
      { user_id: userId, mois, [column]: current + 1 },
      { onConflict: "user_id,mois" }
    );

  return { allowed: true };
}

export async function checkAndIncrementExerciceUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; used?: number; limit?: number }> {
  return checkAndIncrement(supabase, userId, "nb_exercices", FREE_PLAN_MONTHLY_LIMIT);
}

export async function checkAndIncrementCorrectionUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; used?: number; limit?: number }> {
  return checkAndIncrement(supabase, userId, "nb_corrections", FREE_PLAN_MONTHLY_CORRECTIONS);
}

export async function checkAndIncrementRemediationUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; used?: number; limit?: number }> {
  return checkAndIncrement(supabase, userId, "nb_remediations", FREE_PLAN_MONTHLY_REMEDIATIONS);
}

/**
 * Retourne le nombre d'exercices générés ce mois-ci et la limite.
 * Pour affichage dans l'UI (ex: dashboard, bannière freemium).
 */
export async function getExerciceUsageSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<{ used: number; limit: number | null; plan: string }> {

  const plan = await getUserPlan(supabase, userId);

  if (plan !== "free") {
    return { used: 0, limit: null, plan };
  }

  const mois = new Date().toISOString().slice(0, 7);
  const { data: usage } = await supabase
    .from("usage_mensuel")
    .select("nb_exercices")
    .eq("user_id", userId)
    .eq("mois", mois)
    .single();

  const used = (usage as { nb_exercices?: number } | null)?.nb_exercices ?? 0;
  return { used, limit: FREE_PLAN_MONTHLY_LIMIT, plan };
}
