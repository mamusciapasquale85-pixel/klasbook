import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/teacher",
  "/parent",
  "/admin",
  "/onboarding",
  "/direction",
  "/competences",
  "/bulletins",
  "/evaluations",
  "/apprentissages",
  "/agenda",
  "/absences",
  "/eleves",
  "/eleve",
  "/discipline",
  "/import",
  "/dashboard",
  "/classe",
  "/remediations",
  "/outils",
  "/generateur",
  "/historique",
  "/creer-evaluation",
  "/planification",
  "/seances-remediation",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = await updateSession(request);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-"));

    if (!hasAuthCookie) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.startsWith("/parent") ? "/parent-login" : "/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
