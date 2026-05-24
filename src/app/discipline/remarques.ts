"use client";

import type { TeacherContext } from "@/lib/teacher-context";
export type { TeacherContext } from "@/lib/teacher-context";
export { getTeacherContext } from "@/lib/teacher-context";

export type UUID = string;

export type ClassGroup = {
  id: UUID;
  name: string;
  grade_level: number | null;
};

export type StudentLite = {
  id: UUID;
  first_name: string;
  last_name: string;
  email: string | null;
};

export type DisciplineNoteRow = {
  id: UUID;
  class_group_id: UUID | null;
  class_name: string | null;
  student_id: UUID;
  student_first_name: string;
  student_last_name: string;
  note: string;
  created_at: string;
};

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  CLASS_GROUPS: "class_groups",
  STUDENT_ENROLLMENTS: "student_enrollments",
  STUDENTS: "students",
  DISCIPLINE_NOTES: "discipline_notes",
} as const;

export function toNiceError(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message) return error.message;
    if ("error_description" in error && typeof error.error_description === "string" && error.error_description) {
      return error.error_description;
    }
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function isMissingDisciplineTable(error: unknown): boolean {
  const msg = toNiceError(error).toLowerCase();
  return msg.includes("discipline_notes") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

function isMissingColumn(error: unknown, column: string): boolean {
  const msg = toNiceError(error).toLowerCase();
  return msg.includes(column.toLowerCase()) && (msg.includes("schema cache") || msg.includes("does not exist"));
}

export async function listClassGroups(ctx: TeacherContext): Promise<ClassGroup[]> {
  const { data, error } = await ctx.supabase
    .from(T.CLASS_GROUPS)
    .select("id,name,grade_level")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .order("grade_level", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClassGroup[];
}

export async function listStudentsForClass(ctx: TeacherContext, classGroupId: UUID): Promise<StudentLite[]> {
  if (!classGroupId) return [];

  const { data: enrollments, error: enrErr } = await ctx.supabase
    .from(T.STUDENT_ENROLLMENTS)
    .select("student_id")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .eq("class_group_id", classGroupId);

  if (enrErr) throw enrErr;

  const studentIds = Array.from(new Set((enrollments ?? []).map((row: any) => row.student_id).filter(Boolean) as UUID[]));
  if (studentIds.length === 0) return [];

  const runStudentsQuery = async (withEmail: boolean) => {
    const selectCols = withEmail ? "id,first_name,last_name,email" : "id,first_name,last_name";
    return ctx.supabase
      .from(T.STUDENTS)
      .select(selectCols)
      .eq("school_id", ctx.schoolId)
      .in("id", studentIds)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });
  };

  let query = await runStudentsQuery(true);
  if (query.error && isMissingColumn(query.error, "email")) {
    query = await runStudentsQuery(false);
  }
  if (query.error) throw query.error;

  return (query.data ?? []).map((row: any) => ({
    id: row.id as UUID,
    first_name: String(row.first_name ?? ""),
    last_name: String(row.last_name ?? ""),
    email: (row.email ?? null) as string | null,
  }));
}

export async function createDisciplineNote(
  ctx: TeacherContext,
  params: { classGroupId: UUID; studentId: UUID; note: string }
): Promise<void> {
  const note = params.note.trim();
  if (!params.classGroupId) throw new Error("Classe obligatoire.");
  if (!params.studentId) throw new Error("Élève obligatoire.");
  if (!note) throw new Error("Texte obligatoire.");

  const base = {
    school_id: ctx.schoolId,
    academic_year_id: ctx.academicYearId,
    class_group_id: params.classGroupId,
    student_id: params.studentId,
    note,
    date: new Date().toISOString().slice(0, 10),
  };

  let insert = await ctx.supabase.from(T.DISCIPLINE_NOTES).insert({ ...base, teacher_id: ctx.teacherId });
  if (!insert.error) {
    fetch("/api/push-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: params.studentId,
        schoolId: ctx.schoolId,
        title: "⚠️ Nouvelle remarque",
        body: note.length > 100 ? note.slice(0, 97) + "…" : note,
        url: "/parent",
      }),
    }).catch(() => {});
    return;
  }

  if (isMissingDisciplineTable(insert.error)) {
    throw new Error("La table discipline_notes n’existe pas. Applique la migration SQL.");
  }

  if (isMissingColumn(insert.error, "teacher_id")) {
    insert = await ctx.supabase
      .from(T.DISCIPLINE_NOTES)
      .insert({ ...base, teacher_user_id: ctx.teacherId } as Record<string, unknown>);
    if (!insert.error) return;
  }

  if (isMissingColumn(insert.error, "class_group_id")) {
    insert = await ctx.supabase
      .from(T.DISCIPLINE_NOTES)
      .insert({
        school_id: ctx.schoolId,
        academic_year_id: ctx.academicYearId,
        student_id: params.studentId,
        note,
        date: new Date().toISOString().slice(0, 10),
        teacher_user_id: ctx.teacherId,
      } as Record<string, unknown>);
    if (!insert.error) return;
  }

  throw insert.error;
}

export async function listDisciplineNotes(
  ctx: TeacherContext,
  params?: { classGroupId?: UUID | ""; limit?: number }
): Promise<DisciplineNoteRow[]> {
  const classGroupId = params?.classGroupId ?? "";
  const limit = params?.limit ?? 80;

  const runQuery = async (teacherColumn: "teacher_id" | "teacher_user_id", includeClassGroup: boolean) => {
    const cols = includeClassGroup
      ? "id,class_group_id,student_id,note,created_at,class_groups(name),students(first_name,last_name)"
      : "id,student_id,note,created_at,students(first_name,last_name)";

    let q = ctx.supabase
      .from(T.DISCIPLINE_NOTES)
      .select(cols)
      .eq("school_id", ctx.schoolId)
      .eq("academic_year_id", ctx.academicYearId)
      .eq(teacherColumn, ctx.teacherId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (includeClassGroup && classGroupId) q = q.eq("class_group_id", classGroupId);
    return q;
  };

  let result = await runQuery("teacher_id", true);
  if (result.error && isMissingColumn(result.error, "teacher_id")) {
    result = await runQuery("teacher_user_id", true);
  }
  if (result.error && isMissingColumn(result.error, "class_group_id")) {
    result = await runQuery("teacher_user_id", false);
  }

  if (result.error) {
    if (isMissingDisciplineTable(result.error)) return [];
    throw result.error;
  }

  return (result.data ?? []).map((row: any) => {
    const studentJoined = Array.isArray(row.students) ? row.students[0] : row.students;
    const classJoined = Array.isArray(row.class_groups) ? row.class_groups[0] : row.class_groups;

    return {
      id: row.id as UUID,
      class_group_id: (row.class_group_id ?? null) as UUID | null,
      class_name: (classJoined?.name ?? null) as string | null,
      student_id: row.student_id as UUID,
      student_first_name: String(studentJoined?.first_name ?? ""),
      student_last_name: String(studentJoined?.last_name ?? ""),
      note: String(row.note ?? ""),
      created_at: String(row.created_at ?? ""),
    };
  });
}
