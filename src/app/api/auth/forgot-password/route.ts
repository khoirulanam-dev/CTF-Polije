import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const turnstileToken = String(body.turnstile_token || "");

    const captcha = await verifyTurnstileToken(turnstileToken, request);
    if (!captcha.success) {
      return NextResponse.json(
        { message: captcha.error || "CAPTCHA tidak valid." },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json({ message: "Email wajib diisi." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ message: "Konfigurasi server belum lengkap." }, { status: 500 });
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Use only the server-side env var — never trust the client-supplied Origin header
    // because it can be spoofed to redirect users to a phishing domain.
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/challenges`,
    });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CAPTCHA forgot-password error:", error);
    return NextResponse.json({ message: "Failed to send reset email" }, { status: 500 });
  }
}
