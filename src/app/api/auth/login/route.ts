import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = String(body.identifier || "").trim();
    const password = String(body.password || "");
    const turnstileToken = String(body.turnstile_token || "");

    const captcha = await verifyTurnstileToken(turnstileToken, request);
    if (!captcha.success) {
      return NextResponse.json(
        { message: captcha.error || "CAPTCHA tidak valid." },
        { status: 400 },
      );
    }

    if (!identifier || !password) {
      return NextResponse.json({ message: "Username/email dan password wajib diisi." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ message: "Konfigurasi server belum lengkap." }, { status: 500 });
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let email = identifier;
    if (!identifier.includes("@")) {
      const { data: rpcEmail, error: rpcError } = await client.rpc(
        "get_email_by_username",
        { p_username: identifier },
      );
      if (rpcError || !rpcEmail) {
        return NextResponse.json({ message: "User not found" }, { status: 401 });
      }
      email = rpcEmail;
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      return NextResponse.json(
        { message: error?.message || "Login failed" },
        { status: 401 },
      );
    }

    return NextResponse.json({ session: data.session });
  } catch (error) {
    console.error("CAPTCHA login error:", error);
    return NextResponse.json({ message: "Login failed" }, { status: 500 });
  }
}
