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

export type Course = {
  id: UUID;
  name: string;
};

export type Apprentissage = {
  id: UUID;
  name: string;
  order_index: number;
  active: boolean;
};

export type AssessmentType = "formative" | "summative";
export type ContentStatus = "draft" | "published" | "archived";

export type Assessment = {
  id: UUID;
  title: string;
  type: AssessmentType;
  date: string; // YYYY-MM-DD
  max_points: number | null;
  weight: number | null;
  status: ContentStatus;
  parent_visible: boolean;
  instructions: string | null;
  class_group_id: UUID | null;
  course_id: UUID | null;
  apprentissage_id: UUID | null;
  created_at: string;
  updated_at: string;
  fichier_path: string | null;
  fichier_nom: string | null;
  cotation_type: "points" | "nisbttb";
  competences_evaluees: string[];
  answer_key?: unknown | null;
  template_id?: string | null;
};

export type ParsedAssessmentCsvRow = {
  line: number;
  title: string;
  date: string;
  class_ref: string;
  course_ref: string;
  type_raw: string;
  status_raw: string;
  max_points_raw: string;
  weight_raw: string;
  parent_visible_raw: string;
  instructions_raw: string;
  apprentissage_ref: string;
};

export type AssessmentCsvImportError = {
  line: number;
  message: string;
};

export type AssessmentCsvImportSummary = {
  rowsTotal: number;
  rowsReady: number;
  created: number;
  alreadyExisting: number;
  errors: AssessmentCsvImportError[];
};

export type ResultLevel = "NI" | "I" | "S" | "B" | "TB";

export type ParsedAssessmentResultCsvRow = {
  line: number;
  student_ref: string;
  last_name: string;
  first_name: string;
  class_ref: string;
  assessment_ref: string;
  assessment_title: string;
  assessment_date: string;
  value_raw: string;
  level_raw: string;
};

export type AssessmentResultCsvImportError = {
  line: number;
  message: string;
};

export type AssessmentResultCsvImportSummary = {
  rowsTotal: number;
  rowsReady: number;
  upserted: number;
  duplicatedInFile: number;
  errors: AssessmentResultCsvImportError[];
};

const T = {
  SCHOOL_MEMBERSHIPS: "school_memberships",
  ACADEMIC_YEARS: "academic_years",
  CLASS_GROUPS: "class_groups",
  COURSES: "courses",
  APPRENTISSAGES: "apprentissages",
  ASSESSMENTS: "assessments",
  STUDENT_ENROLLMENTS: "student_enrollments",
  RESULTATS: "resultats",
} as const;

function getErrMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  return String(error);
}

function isMissingApprentissagesTable(error: unknown): boolean {
  const m = getErrMessage(error).toLowerCase();
  return m.includes("public.apprentissages") && m.includes("schema cache");
}

function isMissingAssessmentsApprentissageColumn(error: unknown): boolean {
  const m = getErrMessage(error).toLowerCase();
  return (
    m.includes("assessments.apprentissage_id") ||
    m.includes("column 'apprentissage_id'") ||
    m.includes("column apprentissage_id")
  );
}

function isMissingStudentRefColumn(error: unknown): boolean {
  const m = getErrMessage(error).toLowerCase();
  return m.includes("student_ref") && (m.includes("schema cache") || m.includes("does not exist"));
}

const ASSESSMENT_SELECT_WITH_APP =
  "id, title, type, date, max_points, weight, status, parent_visible, instructions, class_group_id, course_id, apprentissage_id, cotation_type, competences_evaluees, fichier_path, fichier_nom, created_at, updated_at, answer_key";
const ASSESSMENT_SELECT_NO_APP =
  "id, title, type, date, max_points, weight, status, parent_visible, instructions, class_group_id, course_id, cotation_type, competences_evaluees, fichier_path, fichier_nom, created_at, updated_at, answer_key";
const ASSESSMENT_IMPORT_EXISTING_SELECT = "id, title, type, date, class_group_id, course_id";

function normalizeAssessmentRows(rows: any[]): Assessment[] {
  return rows.map((r) => ({
    ...r,
    apprentissage_id: r.apprentissage_id ?? null,
  })) as Assessment[];
}

function splitCsvLine(line: string, delimiter: "," | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function countDelimiter(line: string, delimiter: "," | ";"): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) count += 1;
  }
  return count;
}

function normalizeHeaderCell(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[ -]+/g, "_");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function normalizeNameForMatch(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTextForKey(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseAssessmentTypeRaw(raw: string): AssessmentType | null {
  const v = raw.trim().toLowerCase();
  if (!v) return "summative";
  if (v === "summative" || v === "sommative") return "summative";
  if (v === "formative") return "formative";
  return null;
}

function parseContentStatusRaw(raw: string): ContentStatus | null {
  const v = raw.trim().toLowerCase();
  if (!v) return "draft";
  if (v === "draft" || v === "brouillon") return "draft";
  if (v === "published" || v === "publie" || v === "publié") return "published";
  if (v === "archived" || v === "archive" || v === "archivé") return "archived";
  return null;
}

function parseNullableNumber(raw: string, fieldLabel: string): { value: number | null; error: string | null } {
  const v = raw.trim();
  if (!v) return { value: null, error: null };
  const parsed = Number(v.replace(",", "."));
  if (Number.isNaN(parsed)) return { value: null, error: `${fieldLabel} invalide (${raw}).` };
  return { value: parsed, error: null };
}

function parseParentVisibleRaw(raw: string): { value: boolean; error: string | null } {
  const v = raw.trim().toLowerCase();
  if (!v) return { value: false, error: null };
  if (["1", "true", "yes", "oui", "y"].includes(v)) return { value: true, error: null };
  if (["0", "false", "no", "non", "n"].includes(v)) return { value: false, error: null };
  return { value: false, error: `parent_visible invalide (${raw}).` };
}

function parseResultLevelRaw(raw: string): ResultLevel | null {
  const v = raw.trim().toUpperCase();
  if (!v) return null;
  if (v === "NI" || v === "I" || v === "S" || v === "B" || v === "TB") return v;
  return null;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.toISOString().slice(0, 10) === value;
}

function makeAssessmentImportKey(input: {
  class_group_id: UUID;
  course_id: UUID;
  title: string;
  date: string;
}): string {
  return `${input.class_group_id}|${input.course_id}|${normalizeTextForKey(input.title)}|${input.date}`;
}

function chunkArray<T>(arr: T[], size: number): T[][];
function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function listClassGroups(ctx: TeacherContext): Promise<ClassGroup[]> {
  const { data, error } = await ctx.supabase
    .from(T.CLASS_GROUPS)
    .select("id, name, grade_level")
    .eq("school_id", ctx.schoolId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClassGroup[];
}

export async function listCourses(ctx: TeacherContext): Promise<Course[]> {
  const { data, error } = await ctx.supabase
    .from(T.COURSES)
    .select("id, name")
    .eq("school_id", ctx.schoolId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Course[];
}

export async function listApprentissages(ctx: TeacherContext): Promise<Apprentissage[]> {
  const { data, error } = await ctx.supabase
    .from(T.APPRENTISSAGES)
    .select("id, name, order_index, active")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .order("order_index", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    // Migration non appliquée: on masque la feature au lieu de casser l'écran.
    if (isMissingApprentissagesTable(error)) return [];
    throw error;
  }
  return (data ?? []) as Apprentissage[];
}

export async function listAssessments(params: {
  ctx: TeacherContext;
  classGroupId?: UUID | null;
  courseId?: UUID | null;
  apprentissageId?: UUID | null;
  date?: string | null;
  assessmentId?: UUID | null;
}): Promise<Assessment[]> {
  const { ctx } = params;

  const applyCommonFilters = (q: any) => {
    let next = q
      .eq("school_id", ctx.schoolId)
      .order("date", { ascending: false });

    if (params.assessmentId) next = next.eq("id", params.assessmentId);
    if (params.classGroupId) next = next.eq("class_group_id", params.classGroupId);
    if (params.courseId) next = next.eq("course_id", params.courseId);
    if (params.date) next = next.eq("date", params.date);
    return next;
  };

  let withApp = applyCommonFilters(ctx.supabase.from(T.ASSESSMENTS).select(ASSESSMENT_SELECT_WITH_APP));
  if (params.apprentissageId) withApp = withApp.eq("apprentissage_id", params.apprentissageId);

  const first = await withApp;
  if (!first.error) return normalizeAssessmentRows(first.data ?? []);
  if (!isMissingAssessmentsApprentissageColumn(first.error)) throw first.error;

  // Fallback pour bases où assessments.apprentissage_id n'existe pas encore.
  if (params.apprentissageId) return [];
  const withoutApp = await applyCommonFilters(ctx.supabase.from(T.ASSESSMENTS).select(ASSESSMENT_SELECT_NO_APP));
  if (withoutApp.error) throw withoutApp.error;
  return normalizeAssessmentRows(withoutApp.data ?? []);
}

export function parseAssessmentsCsv(csvText: string): ParsedAssessmentCsvRow[] {
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const headerLineIndex = lines.findIndex((l) => l.trim().length > 0);
  if (headerLineIndex < 0) throw new Error("CSV vide.");

  const headerLine = lines[headerLineIndex];
  const delimiter: "," | ";" = countDelimiter(headerLine, ";") > countDelimiter(headerLine, ",") ? ";" : ",";
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeaderCell);

  const idxTitle = findHeaderIndex(headers, ["title", "assessment_title", "titre"]);
  const idxDate = findHeaderIndex(headers, ["date", "assessment_date"]);

  const idxClassId = findHeaderIndex(headers, ["class_id", "class_group_id"]);
  const idxClassName = findHeaderIndex(headers, ["class_name", "class", "classe"]);

  const idxCourseId = findHeaderIndex(headers, ["course_id"]);
  const idxCourseName = findHeaderIndex(headers, ["course_name", "course", "cours"]);

  const idxType = findHeaderIndex(headers, ["type"]);
  const idxStatus = findHeaderIndex(headers, ["status", "statut"]);
  const idxMaxPoints = findHeaderIndex(headers, ["max_points", "max_point", "points_max", "max"]);
  const idxWeight = findHeaderIndex(headers, ["weight", "poids"]);
  const idxParentVisible = findHeaderIndex(headers, ["parent_visible", "visible_parents", "parents_visible"]);
  const idxInstructions = findHeaderIndex(headers, ["instructions", "instruction"]);
  const idxApprentissageId = findHeaderIndex(headers, ["apprentissage_id"]);
  const idxApprentissageName = findHeaderIndex(headers, ["apprentissage", "apprentissages"]);

  if (idxTitle < 0 || idxDate < 0) {
    throw new Error("Colonnes requises manquantes: title,date.");
  }
  if (idxClassId < 0 && idxClassName < 0) {
    throw new Error("Colonne classe manquante: class_id ou class_name.");
  }
  if (idxCourseId < 0 && idxCourseName < 0) {
    throw new Error("Colonne cours manquante: course_id ou course_name.");
  }

  const out: ParsedAssessmentCsvRow[] = [];
  for (let i = headerLineIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    const cols = splitCsvLine(line, delimiter);

    const classRef = (idxClassId >= 0 ? cols[idxClassId] : "")?.trim() || (idxClassName >= 0 ? cols[idxClassName] : "")?.trim() || "";
    const courseRef = (idxCourseId >= 0 ? cols[idxCourseId] : "")?.trim() || (idxCourseName >= 0 ? cols[idxCourseName] : "")?.trim() || "";

    out.push({
      line: i + 1,
      title: (cols[idxTitle] ?? "").trim(),
      date: (cols[idxDate] ?? "").trim(),
      class_ref: classRef,
      course_ref: courseRef,
      type_raw: idxType >= 0 ? (cols[idxType] ?? "").trim() : "",
      status_raw: idxStatus >= 0 ? (cols[idxStatus] ?? "").trim() : "",
      max_points_raw: idxMaxPoints >= 0 ? (cols[idxMaxPoints] ?? "").trim() : "",
      weight_raw: idxWeight >= 0 ? (cols[idxWeight] ?? "").trim() : "",
      parent_visible_raw: idxParentVisible >= 0 ? (cols[idxParentVisible] ?? "").trim() : "",
      instructions_raw: idxInstructions >= 0 ? (cols[idxInstructions] ?? "").trim() : "",
      apprentissage_ref:
        (idxApprentissageId >= 0 ? (cols[idxApprentissageId] ?? "").trim() : "") ||
        (idxApprentissageName >= 0 ? (cols[idxApprentissageName] ?? "").trim() : ""),
    });
  }

  return out;
}

export function parseAssessmentResultsCsv(csvText: string): ParsedAssessmentResultCsvRow[] {
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const headerLineIndex = lines.findIndex((l) => l.trim().length > 0);
  if (headerLineIndex < 0) throw new Error("CSV vide.");

  const headerLine = lines[headerLineIndex];
  const delimiter: "," | ";" = countDelimiter(headerLine, ";") > countDelimiter(headerLine, ",") ? ";" : ",";
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeaderCell);

  const idxStudentRef = findHeaderIndex(headers, ["student_ref", "reference", "ref", "id_externe", "matricule"]);
  const idxLastName = findHeaderIndex(headers, ["last_name", "nom", "surname"]);
  const idxFirstName = findHeaderIndex(headers, ["first_name", "prenom", "given_name"]);
  const idxClassId = findHeaderIndex(headers, ["class_group_id", "class_id"]);
  const idxClassName = findHeaderIndex(headers, ["class_name", "class", "classe"]);
  const idxAssessmentId = findHeaderIndex(headers, ["assessment_id", "evaluation_id"]);
  const idxAssessmentTitle = findHeaderIndex(headers, ["assessment_title", "evaluation", "evaluation_title", "title"]);
  const idxAssessmentDate = findHeaderIndex(headers, ["assessment_date", "date_evaluation", "date"]);
  const idxValue = findHeaderIndex(headers, ["value", "score", "note", "points", "resultat"]);
  const idxLevel = findHeaderIndex(headers, ["level", "niveau"]);

  if (idxClassId < 0 && idxClassName < 0) {
    throw new Error("Colonne classe manquante: class_group_id ou class_name.");
  }
  if (idxStudentRef < 0 && (idxLastName < 0 || idxFirstName < 0)) {
    throw new Error("Colonnes élève manquantes: student_ref ou first_name+last_name.");
  }
  if (idxValue < 0 && idxLevel < 0) {
    throw new Error("Colonne résultat manquante: value (note) ou level (niveau).");
  }

  const out: ParsedAssessmentResultCsvRow[] = [];
  for (let i = headerLineIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    const cols = splitCsvLine(line, delimiter);

    const studentRef = idxStudentRef >= 0 ? (cols[idxStudentRef] ?? "").trim() : "";
    const firstName = idxFirstName >= 0 ? (cols[idxFirstName] ?? "").trim() : "";
    const lastName = idxLastName >= 0 ? (cols[idxLastName] ?? "").trim() : "";
    const classRef =
      (idxClassId >= 0 ? cols[idxClassId] : "")?.trim() || (idxClassName >= 0 ? cols[idxClassName] : "")?.trim() || "";

    const isEmptyDataLine =
      !studentRef &&
      !firstName &&
      !lastName &&
      !classRef &&
      !(idxValue >= 0 ? (cols[idxValue] ?? "").trim() : "") &&
      !(idxLevel >= 0 ? (cols[idxLevel] ?? "").trim() : "");
    if (isEmptyDataLine) continue;

    out.push({
      line: i + 1,
      student_ref: studentRef,
      last_name: lastName,
      first_name: firstName,
      class_ref: classRef,
      assessment_ref: idxAssessmentId >= 0 ? (cols[idxAssessmentId] ?? "").trim() : "",
      assessment_title: idxAssessmentTitle >= 0 ? (cols[idxAssessmentTitle] ?? "").trim() : "",
      assessment_date: idxAssessmentDate >= 0 ? (cols[idxAssessmentDate] ?? "").trim() : "",
      value_raw: idxValue >= 0 ? (cols[idxValue] ?? "").trim() : "",
      level_raw: idxLevel >= 0 ? (cols[idxLevel] ?? "").trim() : "",
    });
  }

  return out;
}

type AssessmentInsertPayload = {
  school_id: UUID;
  teacher_user_id: UUID;
  class_group_id: UUID;
  course_id: UUID;
  title: string;
  type: AssessmentType;
  date: string;
  max_points: number | null;
  weight: number | null;
  status: ContentStatus;
  parent_visible: boolean;
  instructions: string | null;
  apprentissage_id?: UUID | null;
};

type PreparedAssessmentImportRow = {
  line: number;
  key: string;
  payload: AssessmentInsertPayload;
};

type AssessmentResultInsertPayload = {
  school_id: UUID;
  academic_year_id: UUID;
  teacher_id: UUID;
  student_id: UUID;
  assessment_id: UUID;
  value: number | null;
  level: ResultLevel | null;
};

type PreparedAssessmentResultImportRow = {
  line: number;
  dedupeKey: string;
  payload: AssessmentResultInsertPayload;
};

export async function importAssessmentsCsv(params: {
  ctx: TeacherContext;
  rows: ParsedAssessmentCsvRow[];
  classes: ClassGroup[];
  courses: Course[];
  apprentissages?: Apprentissage[];
}): Promise<AssessmentCsvImportSummary> {
  const { ctx, rows, classes, courses, apprentissages = [] } = params;

  const summary: AssessmentCsvImportSummary = {
    rowsTotal: rows.length,
    rowsReady: 0,
    created: 0,
    alreadyExisting: 0,
    errors: [],
  };

  const classById = new Map<string, UUID>();
  const classByName = new Map<string, UUID>();
  for (const c of classes) {
    classById.set(c.id.toLowerCase(), c.id);
    classByName.set(normalizeNameForMatch(c.name), c.id);
  }

  const courseById = new Map<string, UUID>();
  const courseByName = new Map<string, UUID>();
  for (const c of courses) {
    courseById.set(c.id.toLowerCase(), c.id);
    courseByName.set(normalizeNameForMatch(c.name), c.id);
  }

  const apprentissageById = new Map<string, UUID>();
  const apprentissageByName = new Map<string, UUID>();
  for (const a of apprentissages) {
    apprentissageById.set(a.id.toLowerCase(), a.id);
    apprentissageByName.set(normalizeNameForMatch(a.name), a.id);
  }

  const preparedRows: PreparedAssessmentImportRow[] = [];

  for (const row of rows) {
    const title = row.title.trim();
    const date = row.date.trim();
    const classRef = row.class_ref.trim();
    const courseRef = row.course_ref.trim();
    const apprentissageRef = row.apprentissage_ref.trim();

    if (!title) {
      summary.errors.push({ line: row.line, message: "title manquant." });
      continue;
    }
    if (!date || !isIsoDate(date)) {
      summary.errors.push({ line: row.line, message: `date invalide (${row.date || "vide"}). Format attendu: YYYY-MM-DD.` });
      continue;
    }
    if (!classRef) {
      summary.errors.push({ line: row.line, message: "classe manquante (class_id ou class_name)." });
      continue;
    }
    if (!courseRef) {
      summary.errors.push({ line: row.line, message: "cours manquant (course_id ou course_name)." });
      continue;
    }

    const classId =
      classById.get(classRef.toLowerCase()) ??
      classByName.get(normalizeNameForMatch(classRef));
    if (!classId) {
      summary.errors.push({ line: row.line, message: `classe introuvable (${classRef}).` });
      continue;
    }

    const courseId =
      courseById.get(courseRef.toLowerCase()) ??
      courseByName.get(normalizeNameForMatch(courseRef));
    if (!courseId) {
      summary.errors.push({ line: row.line, message: `cours introuvable (${courseRef}).` });
      continue;
    }

    const type = parseAssessmentTypeRaw(row.type_raw);
    if (!type) {
      summary.errors.push({ line: row.line, message: `type invalide (${row.type_raw}).` });
      continue;
    }

    const status = parseContentStatusRaw(row.status_raw);
    if (!status) {
      summary.errors.push({ line: row.line, message: `status invalide (${row.status_raw}).` });
      continue;
    }

    const maxPointsParsed = parseNullableNumber(row.max_points_raw, "max_points");
    if (maxPointsParsed.error) {
      summary.errors.push({ line: row.line, message: maxPointsParsed.error });
      continue;
    }
    const weightParsed = parseNullableNumber(row.weight_raw, "weight");
    if (weightParsed.error) {
      summary.errors.push({ line: row.line, message: weightParsed.error });
      continue;
    }
    const parentVisibleParsed = parseParentVisibleRaw(row.parent_visible_raw);
    if (parentVisibleParsed.error) {
      summary.errors.push({ line: row.line, message: parentVisibleParsed.error });
      continue;
    }

    const payload: AssessmentInsertPayload = {
      school_id: ctx.schoolId,
      teacher_user_id: ctx.teacherId,
      class_group_id: classId,
      course_id: courseId,
      title,
      type,
      date,
      max_points: maxPointsParsed.value ?? 20,
      weight: weightParsed.value,
      status,
      parent_visible: parentVisibleParsed.value,
      instructions: row.instructions_raw.trim() ? row.instructions_raw.trim() : null,
    };

    if (apprentissageRef) {
      const apprentissageId =
        apprentissageById.get(apprentissageRef.toLowerCase()) ??
        apprentissageByName.get(normalizeNameForMatch(apprentissageRef));
      if (!apprentissageId) {
        summary.errors.push({ line: row.line, message: `apprentissage introuvable (${apprentissageRef}).` });
        continue;
      }
      payload.apprentissage_id = apprentissageId;
    }

    preparedRows.push({
      line: row.line,
      key: makeAssessmentImportKey(payload),
      payload,
    });
  }

  summary.rowsReady = preparedRows.length;
  if (preparedRows.length === 0) return summary;

  const classIds = Array.from(new Set(preparedRows.map((r) => r.payload.class_group_id)));
  const courseIds = Array.from(new Set(preparedRows.map((r) => r.payload.course_id)));
  const dates = Array.from(new Set(preparedRows.map((r) => r.payload.date)));

  let existingQuery = ctx.supabase
    .from(T.ASSESSMENTS)
    .select(ASSESSMENT_IMPORT_EXISTING_SELECT)
    .eq("school_id", ctx.schoolId)
    .eq("teacher_user_id", ctx.teacherId);

  if (classIds.length > 0) existingQuery = existingQuery.in("class_group_id", classIds);
  if (courseIds.length > 0) existingQuery = existingQuery.in("course_id", courseIds);
  if (dates.length > 0) existingQuery = existingQuery.in("date", dates);

  const existing = await existingQuery;
  if (existing.error) throw existing.error;

  const existingKeys = new Set<string>();
  for (const r of existing.data ?? []) {
    if (!r.class_group_id || !r.course_id || !r.date || !r.title || !r.type) continue;
    existingKeys.add(
      makeAssessmentImportKey({
        class_group_id: r.class_group_id as UUID,
        course_id: r.course_id as UUID,
        title: String(r.title),
        date: String(r.date),
      })
    );
  }

  const seenCsvKeys = new Set<string>();
  const rowsToInsert: PreparedAssessmentImportRow[] = [];
  for (const row of preparedRows) {
    if (existingKeys.has(row.key) || seenCsvKeys.has(row.key)) {
      summary.alreadyExisting += 1;
      continue;
    }
    seenCsvKeys.add(row.key);
    rowsToInsert.push(row);
  }

  if (rowsToInsert.length === 0) return summary;

  for (const chunk of chunkArray(rowsToInsert, 200)) {
    const payloads = chunk.map((r) => r.payload);
    let bulk = await ctx.supabase.from(T.ASSESSMENTS).insert(payloads);
    if (bulk.error && isMissingAssessmentsApprentissageColumn(bulk.error)) {
      const withoutApp = payloads.map((p) => {
        const copy = { ...p } as Record<string, unknown>;
        delete copy.apprentissage_id;
        return copy;
      });
      bulk = await ctx.supabase.from(T.ASSESSMENTS).insert(withoutApp);
    }
    if (!bulk.error) {
      summary.created += chunk.length;
      continue;
    }

    // Fallback ligne par ligne pour loguer précisément les erreurs.
    for (const row of chunk) {
      let single = await ctx.supabase.from(T.ASSESSMENTS).insert(row.payload);
      if (single.error && isMissingAssessmentsApprentissageColumn(single.error)) {
        const withoutApp = { ...row.payload } as Record<string, unknown>;
        delete withoutApp.apprentissage_id;
        single = await ctx.supabase.from(T.ASSESSMENTS).insert(withoutApp);
      }
      if (single.error) {
        summary.errors.push({ line: row.line, message: getErrMessage(single.error) });
      } else {
        summary.created += 1;
      }
    }
  }

  return summary;
}

export async function importAssessmentResultsCsv(params: {
  ctx: TeacherContext;
  rows: ParsedAssessmentResultCsvRow[];
  classes: ClassGroup[];
  targetAssessmentId?: UUID | null;
}): Promise<AssessmentResultCsvImportSummary> {
  const { ctx, rows, classes, targetAssessmentId = null } = params;

  const summary: AssessmentResultCsvImportSummary = {
    rowsTotal: rows.length,
    rowsReady: 0,
    upserted: 0,
    duplicatedInFile: 0,
    errors: [],
  };

  const classById = new Map<string, UUID>();
  const classByName = new Map<string, UUID>();
  for (const c of classes) {
    classById.set(c.id.toLowerCase(), c.id);
    classByName.set(normalizeNameForMatch(c.name), c.id);
  }

  const targetAssessmentById = new Map<UUID, { id: UUID; class_group_id: UUID | null; date: string; title: string }>();
  if (targetAssessmentId) {
    const target = await ctx.supabase
      .from(T.ASSESSMENTS)
      .select("id,class_group_id,date,title")
      .eq("school_id", ctx.schoolId)
      .eq("teacher_user_id", ctx.teacherId)
      .eq("id", targetAssessmentId)
      .maybeSingle();
    if (target.error) throw target.error;
    if (!target.data?.id) throw new Error("Évaluation cible introuvable.");
    targetAssessmentById.set(target.data.id as UUID, {
      id: target.data.id as UUID,
      class_group_id: (target.data.class_group_id as UUID | null) ?? null,
      date: String(target.data.date),
      title: String(target.data.title ?? ""),
    });
  }

  const classIds = new Set<UUID>();
  const requestedAssessmentIds = new Set<string>();
  const requestedAssessmentDates = new Set<string>();

  const stagedRows: Array<ParsedAssessmentResultCsvRow & { class_group_id: UUID }> = [];
  for (const row of rows) {
    const classRef = row.class_ref.trim();
    const classGroupId =
      classById.get(classRef.toLowerCase()) ??
      classByName.get(normalizeNameForMatch(classRef));
    if (!classGroupId) {
      summary.errors.push({ line: row.line, message: `classe introuvable (${classRef || "vide"}).` });
      continue;
    }

    classIds.add(classGroupId);
    if (row.assessment_ref.trim()) requestedAssessmentIds.add(row.assessment_ref.trim().toLowerCase());
    if (row.assessment_date.trim()) {
      if (!isIsoDate(row.assessment_date.trim())) {
        summary.errors.push({
          line: row.line,
          message: `assessment_date invalide (${row.assessment_date}). Format attendu: YYYY-MM-DD.`,
        });
        continue;
      }
      requestedAssessmentDates.add(row.assessment_date.trim());
    }

    stagedRows.push({ ...row, class_group_id: classGroupId });
  }

  if (stagedRows.length === 0) return summary;

  let enrollments: any = await ctx.supabase
    .from(T.STUDENT_ENROLLMENTS)
    .select("class_group_id, student_id, students!inner(id,first_name,last_name,student_ref)")
    .eq("school_id", ctx.schoolId)
    .eq("academic_year_id", ctx.academicYearId)
    .in("class_group_id", Array.from(classIds));

  if (enrollments.error && isMissingStudentRefColumn(enrollments.error)) {
    enrollments = await ctx.supabase
      .from(T.STUDENT_ENROLLMENTS)
      .select("class_group_id, student_id, students!inner(id,first_name,last_name)")
      .eq("school_id", ctx.schoolId)
      .eq("academic_year_id", ctx.academicYearId)
      .in("class_group_id", Array.from(classIds));
  }
  if (enrollments.error) throw enrollments.error;

  type StudentRef = { id: UUID; first_name: string; last_name: string; student_ref?: string | null };
  const studentsByClass = new Map<UUID, { byRef: Map<string, UUID>; byName: Map<string, UUID> }>();
  for (const classId of classIds) {
    studentsByClass.set(classId, { byRef: new Map(), byName: new Map() });
  }
  for (const row of enrollments.data ?? []) {
    const classId = row.class_group_id as UUID | null;
    if (!classId) continue;
    const bucket = studentsByClass.get(classId);
    if (!bucket) continue;

    const studentObj = (Array.isArray((row as any).students) ? (row as any).students[0] : (row as any).students) as StudentRef | null;
    const studentId = (row.student_id as UUID | null) ?? studentObj?.id ?? null;
    if (!studentId || !studentObj) continue;

    const ref = studentObj.student_ref?.trim();
    if (ref) bucket.byRef.set(ref.toLowerCase(), studentId);
    const nameKey = `${normalizeNameForMatch(studentObj.last_name)}|${normalizeNameForMatch(studentObj.first_name)}`;
    bucket.byName.set(nameKey, studentId);
  }

  const assessmentById = new Map<UUID, { id: UUID; class_group_id: UUID | null; date: string; title: string }>();
  const assessmentByKey = new Map<string, UUID>();

  if (requestedAssessmentIds.size > 0) {
    const assessmentsById = await ctx.supabase
      .from(T.ASSESSMENTS)
      .select("id,class_group_id,date,title")
      .eq("school_id", ctx.schoolId)
      .eq("teacher_user_id", ctx.teacherId)
      .in("id", Array.from(requestedAssessmentIds));
    if (assessmentsById.error) throw assessmentsById.error;
    for (const a of assessmentsById.data ?? []) {
      const id = a.id as UUID;
      assessmentById.set(id, {
        id,
        class_group_id: (a.class_group_id as UUID | null) ?? null,
        date: String(a.date),
        title: String(a.title ?? ""),
      });
    }
  }

  if (stagedRows.some((r) => r.assessment_title.trim() && r.assessment_date.trim())) {
    let byTitleDateQuery = ctx.supabase
      .from(T.ASSESSMENTS)
      .select("id,class_group_id,date,title")
      .eq("school_id", ctx.schoolId)
      .eq("teacher_user_id", ctx.teacherId)
      .in("class_group_id", Array.from(classIds));

    if (requestedAssessmentDates.size > 0) {
      byTitleDateQuery = byTitleDateQuery.in("date", Array.from(requestedAssessmentDates));
    }

    const assessmentsByTitleDate = await byTitleDateQuery;
    if (assessmentsByTitleDate.error) throw assessmentsByTitleDate.error;
    for (const a of assessmentsByTitleDate.data ?? []) {
      const id = a.id as UUID;
      const classGroupId = (a.class_group_id as UUID | null) ?? null;
      const date = String(a.date);
      const title = String(a.title ?? "");
      assessmentById.set(id, { id, class_group_id: classGroupId, date, title });
      if (!classGroupId) continue;
      const key = `${classGroupId}|${date}|${normalizeTextForKey(title)}`;
      if (!assessmentByKey.has(key)) assessmentByKey.set(key, id);
    }
  }

  for (const [id, item] of targetAssessmentById.entries()) {
    assessmentById.set(id, item);
  }

  const dedupedRows = new Map<string, PreparedAssessmentResultImportRow>();

  for (const row of stagedRows) {
    const bucket = studentsByClass.get(row.class_group_id);
    if (!bucket) {
      summary.errors.push({ line: row.line, message: "classe sans élèves inscrits." });
      continue;
    }

    const studentRef = row.student_ref.trim().toLowerCase();
    const studentIdByRef = studentRef ? bucket.byRef.get(studentRef) : null;
    const nameKey = `${normalizeNameForMatch(row.last_name)}|${normalizeNameForMatch(row.first_name)}`;
    const studentIdByName = row.last_name.trim() && row.first_name.trim() ? bucket.byName.get(nameKey) : null;
    const studentId = studentIdByRef ?? studentIdByName ?? null;
    if (!studentId) {
      const studentLabel =
        row.student_ref.trim() ||
        `${row.last_name.trim()} ${row.first_name.trim()}`.trim() ||
        "élève inconnu";
      summary.errors.push({ line: row.line, message: `élève introuvable dans la classe (${studentLabel}).` });
      continue;
    }

    let assessmentId: UUID | null = null;
    if (row.assessment_ref.trim()) {
      const wanted = row.assessment_ref.trim().toLowerCase() as UUID;
      assessmentId = assessmentById.has(wanted) ? wanted : null;
      if (!assessmentId) {
        summary.errors.push({ line: row.line, message: `assessment_id introuvable (${row.assessment_ref}).` });
        continue;
      }
    } else if (row.assessment_title.trim() && row.assessment_date.trim()) {
      const key = `${row.class_group_id}|${row.assessment_date.trim()}|${normalizeTextForKey(row.assessment_title)}`;
      assessmentId = assessmentByKey.get(key) ?? null;
      if (!assessmentId) {
        summary.errors.push({
          line: row.line,
          message: `évaluation introuvable (${row.assessment_title} - ${row.assessment_date}).`,
        });
        continue;
      }
    } else if (targetAssessmentId) {
      assessmentId = targetAssessmentId;
      const target = assessmentById.get(targetAssessmentId);
      if (target?.class_group_id && target.class_group_id !== row.class_group_id) {
        summary.errors.push({
          line: row.line,
          message: `classe CSV (${row.class_ref}) différente de l'évaluation cible.`,
        });
        continue;
      }
    } else {
      summary.errors.push({
        line: row.line,
        message: "évaluation manquante (assessment_id ou assessment_title+assessment_date, sinon choisir une évaluation cible).",
      });
      continue;
    }

    const valueParsed = parseNullableNumber(row.value_raw, "value");
    if (valueParsed.error) {
      summary.errors.push({ line: row.line, message: valueParsed.error });
      continue;
    }
    const levelParsed = parseResultLevelRaw(row.level_raw);
    if (row.level_raw.trim() && !levelParsed) {
      summary.errors.push({ line: row.line, message: `niveau invalide (${row.level_raw}).` });
      continue;
    }
    if (valueParsed.value === null && levelParsed === null) {
      summary.errors.push({ line: row.line, message: "résultat vide: value ou level requis." });
      continue;
    }

    const payload: AssessmentResultInsertPayload = {
      school_id: ctx.schoolId,
      academic_year_id: ctx.academicYearId,
      teacher_id: ctx.teacherId,
      student_id: studentId,
      assessment_id: assessmentId,
      value: valueParsed.value,
      level: levelParsed,
    };

    const dedupeKey = `${studentId}|${assessmentId}`;
    if (dedupedRows.has(dedupeKey)) summary.duplicatedInFile += 1;
    dedupedRows.set(dedupeKey, { line: row.line, dedupeKey, payload });
  }

  const rowsToUpsert = Array.from(dedupedRows.values());
  summary.rowsReady = rowsToUpsert.length;
  if (rowsToUpsert.length === 0) return summary;

  for (const chunk of chunkArray(rowsToUpsert, 200)) {
    const payloads = chunk.map((r) => r.payload);
    const bulk = await ctx.supabase.from(T.RESULTATS).upsert(payloads, { onConflict: "student_id,assessment_id" });
    if (!bulk.error) {
      summary.upserted += chunk.length;
      continue;
    }

    for (const row of chunk) {
      const single = await ctx.supabase
        .from(T.RESULTATS)
        .upsert(row.payload, { onConflict: "student_id,assessment_id" });
      if (single.error) {
        summary.errors.push({ line: row.line, message: getErrMessage(single.error) });
      } else {
        summary.upserted += 1;
      }
    }
  }

  return summary;
}

export async function createAssessment(params: {
  ctx: TeacherContext;
  title: string;
  type: AssessmentType;
  date: string;
  max_points: number | null;
  weight: number | null;
  status: ContentStatus;
  parent_visible: boolean;
  instructions: string | null;
  class_group_id: UUID | null;
  course_id: UUID | null;
  apprentissage_id: UUID | null;
  cotation_type?: "points" | "nisbttb";
  competences_evaluees?: string[];
}): Promise<Assessment> {
  const { ctx, apprentissage_id, cotation_type, competences_evaluees, ...rest } = params;

  const basePayload = {
    school_id: ctx.schoolId,
    teacher_user_id: ctx.teacherId,
    cotation_type: cotation_type ?? "points",
    competences_evaluees: competences_evaluees ?? [],
    ...rest,
  };
  const payloadWithApp = apprentissage_id ? { ...basePayload, apprentissage_id } : basePayload;

  let first = await ctx.supabase
    .from(T.ASSESSMENTS)
    .insert(payloadWithApp)
    .select(ASSESSMENT_SELECT_WITH_APP)
    .maybeSingle();

  if (first.error && isMissingAssessmentsApprentissageColumn(first.error)) {
    first = await ctx.supabase
      .from(T.ASSESSMENTS)
      .insert(basePayload)
      .select(ASSESSMENT_SELECT_NO_APP)
      .maybeSingle();
  }

  if (first.error) throw first.error;
  if (!first.data) throw new Error("Création échouée (pas de retour).");

  return { ...(first.data as any), apprentissage_id: (first.data as any).apprentissage_id ?? null } as Assessment;
}

export async function updateAssessment(params: {
  ctx: TeacherContext;
  assessmentId: UUID;
  patch: Partial<
    Pick<
      Assessment,
      | "title"
      | "type"
      | "date"
      | "max_points"
      | "weight"
      | "status"
      | "parent_visible"
      | "instructions"
      | "class_group_id"
      | "course_id"
      | "apprentissage_id"
    >
  >;
}): Promise<Assessment> {
  const { ctx, assessmentId, patch } = params;

  let first = await ctx.supabase
    .from(T.ASSESSMENTS)
    .update(patch)
    .eq("id", assessmentId)
    .eq("school_id", ctx.schoolId)
    .eq("teacher_user_id", ctx.teacherId)
    .select(ASSESSMENT_SELECT_WITH_APP)
    .maybeSingle();

  if (first.error && isMissingAssessmentsApprentissageColumn(first.error)) {
    const patchWithoutApp = { ...patch } as Record<string, unknown>;
    delete patchWithoutApp.apprentissage_id;

    first = await ctx.supabase
      .from(T.ASSESSMENTS)
      .update(patchWithoutApp)
      .eq("id", assessmentId)
      .eq("school_id", ctx.schoolId)
      .eq("teacher_user_id", ctx.teacherId)
      .select(ASSESSMENT_SELECT_NO_APP)
      .maybeSingle();
  }

  if (first.error) throw first.error;
  if (!first.data) throw new Error("Mise à jour échouée (pas de retour).");

  return { ...(first.data as any), apprentissage_id: (first.data as any).apprentissage_id ?? null } as Assessment;
}

export async function deleteAssessment(params: { ctx: TeacherContext; assessmentId: UUID }): Promise<void> {
  const { ctx, assessmentId } = params;

  const { error } = await ctx.supabase
    .from(T.ASSESSMENTS)
    .delete()
    .eq("id", assessmentId)
    .eq("school_id", ctx.schoolId)
    .eq("teacher_user_id", ctx.teacherId);

  if (error) throw error;
}

// Resultats par competence
export async function upsertResult(params: {
  ctx: TeacherContext;
  assessmentId: UUID;
  studentId: UUID;
  value: number | null;
  level?: string | null;
  competencyScores: Record<string, string | number>;
}): Promise<void> {
  const { ctx, assessmentId, studentId, value, level, competencyScores } = params;
  const { error } = await ctx.supabase
    .from("resultats")
    .upsert({
      school_id: ctx.schoolId,
      academic_year_id: ctx.academicYearId,
      teacher_id: ctx.teacherId,
      student_id: studentId,
      assessment_id: assessmentId,
      value: value,
      level: level ?? null,
      competency_scores: competencyScores,
    }, { onConflict: "student_id,assessment_id" });
  if (error) throw error;

  // Notifier les parents en arrière-plan (échec silencieux)
  fetch("/api/push-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, schoolId: ctx.schoolId }),
  }).catch(() => {});
}

export async function listResultsForAssessment(params: {
  ctx: TeacherContext;
  assessmentId: UUID;
}): Promise<Array<{ student_id: UUID; value: number | null; competency_scores: Record<string, string | number> }>> {
  const { ctx, assessmentId } = params;
  const { data, error } = await ctx.supabase
    .from("resultats")
    .select("student_id, value, level, competency_scores")
    .eq("assessment_id", assessmentId)
    .eq("school_id", ctx.schoolId);
  if (error) throw error;
  return (data ?? []) as any[];
}
