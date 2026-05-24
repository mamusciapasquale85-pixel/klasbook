import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendPushToParentsOfStudent } from "@/lib/push-send";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { studentId, schoolId, title, body, url } = await req.json() as {
      studentId: string;
      schoolId: string;
      title?: string;
      body?: string;
      url?: string;
    };

    if (!studentId || !schoolId) {
      return NextResponse.json({ error: "studentId et schoolId requis" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    // Récupérer le prénom de l'élève pour personnaliser la notification
    const { data: student } = await supabase
      .from("students")
      .select("first_name")
      .eq("id", studentId)
      .maybeSingle();

    const firstName = student?.first_name ?? "votre enfant";

    await sendPushToParentsOfStudent(studentId, schoolId, {
      title: title ?? `📊 Nouveau résultat — ${firstName}`,
      body: body ?? `Un résultat a été enregistré pour ${firstName}.`,
      url: url ?? "/parent",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Ne pas faire échouer la requête principale si le push échoue
    console.error("push-notify error:", e.message);
    return NextResponse.json({ ok: true });
  }
}
