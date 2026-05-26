import { createClient } from "@/lib/supabase/client";

export type TeacherContext = {
  supabase: ReturnType<typeof createClient>;
  schoolId: string;
  academicYearId: string;
  teacherId: string;
};

export async function getTeacherContext(): Promise<TeacherContext> {
  const supabase = createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Pas connecté");

  const { data: mem, error: memErr } = await supabase
    .from("school_memberships")
    .select("school_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memErr) throw memErr;
  if (!mem?.school_id) throw new Error("Impossible de trouver school_id (school_memberships).");

  const { data: ay, error: ayErr } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", mem.school_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ayErr) throw ayErr;
  if (!ay?.id) throw new Error("Aucune année scolaire trouvée.");

  return {
    supabase,
    schoolId: mem.school_id,
    academicYearId: ay.id,
    teacherId: user.id,
  };
}
