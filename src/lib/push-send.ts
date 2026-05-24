import webpush from "web-push";
import { createClient as createAdminClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  "mailto:mamuscia.pasquale.85@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushToParentsOfStudent(
  studentId: string,
  schoolId: string,
  payload: { title: string; body: string; url?: string }
) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Récupérer les parents liés à cet élève
  const { data: links } = await admin
    .from("parent_links")
    .select("parent_user_id")
    .eq("student_id", studentId)
    .eq("school_id", schoolId);

  if (!links?.length) return;

  const parentIds = links.map((l) => l.parent_user_id);

  // Récupérer leurs subscriptions push
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("subscription, user_id")
    .in("user_id", parentIds);

  if (!subs?.length) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/parent",
  });

  await Promise.allSettled(
    subs.map(({ subscription, user_id }) =>
      webpush.sendNotification(subscription as webpush.PushSubscription, message).catch(async (err) => {
        // Subscription expirée — on la supprime
        if (err.statusCode === 410) {
          await admin.from("push_subscriptions").delete()
            .eq("user_id", user_id)
            .eq("subscription->>endpoint", (subscription as any).endpoint);
        }
      })
    )
  );
}
