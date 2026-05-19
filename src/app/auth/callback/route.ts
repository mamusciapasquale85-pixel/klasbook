import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const origin = requestUrl.origin;

  if (!code) return NextResponse.redirect(`${origin}/login`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.redirect(`${origin}/login?error=missing_env`);

  const response = NextResponse.redirect(`${origin}/teacher`);
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=callback`);

  // Redirect explicite (ex: reset password)
  if (next) return NextResponse.redirect(`${origin}${next}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Vérifier si l'utilisateur a un membership (limit(1) évite l'échec de .single() en cas de doublons)
  const { data: memberships } = await supabase
    .from("school_memberships")
    .select("role")
    .eq("user_id", user.id)
    .limit(1);

  const membership = memberships?.[0] ?? null;

  // Pas de membership → onboarding
  if (!membership) return NextResponse.redirect(`${origin}/onboarding`);

  // Rediriger selon le rôle
  const role = membership.role;
  if (role === "admin") return NextResponse.redirect(`${origin}/direction`);
  if (role === "parent") return NextResponse.redirect(`${origin}/parent`);
  return NextResponse.redirect(`${origin}/dashboard`);
}
