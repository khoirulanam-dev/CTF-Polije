// src/app/api/register/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { validatePassword } from "@/lib/password";

export async function POST(req: Request) {
  try {
    // Vercel provides x-real-ip from the edge. Do not trust a client-supplied
    // x-forwarded-for value as the primary identity of the caller.
    const clientKey = req.headers.get("x-real-ip")?.trim() || "unknown-client";
    const { data: rateLimited, error: rateLimitError } = await supabase.rpc(
      "check_registration_rate_limit",
      { p_key: clientKey, p_max_attempts: 5, p_window_seconds: 900 }
    );

    if (rateLimitError) {
      console.error("Registration rate limiter unavailable:", rateLimitError.message);
      return NextResponse.json(
        { message: "Registrasi sementara tidak tersedia. Silakan coba lagi nanti." },
        { status: 503 }
      );
    }

    if (rateLimited === true) {
      return NextResponse.json(
        {
          message:
            "Terlalu banyak percobaan registrasi dari IP ini. Harap tunggu 15 menit sebelum mencoba lagi.",
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, username, team_token } = body;

    if (!email || !password || !username || !team_token) {
      return NextResponse.json(
        { message: "Semua kolom wajib diisi (termasuk Team Token)" },
        { status: 400 }
      );
    }


    const REGISTER_TOKEN = process.env.REGISTER_TOKEN;
    if (!REGISTER_TOKEN) {
      console.error("REGISTER_TOKEN is not configured in server environment");
      return NextResponse.json(
        { message: "Konfigurasi server belum lengkap (REGISTER_TOKEN belum diset)" },
        { status: 500 }
      );
    }

    
    if (String(team_token).trim() !== REGISTER_TOKEN.trim()) {
      return NextResponse.json(
        { message: "Team Token tidak valid atau salah" },
        { status: 403 }
      );
    }

    
    const rawDomains = process.env.REGISTER_ALLOWED_DOMAINS ?? "";
    const allowedDomains = rawDomains
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    const lowerEmail = String(email).toLowerCase().trim();

    if (
      allowedDomains.length > 0 &&
      !allowedDomains.some((d) => lowerEmail.endsWith(d))
    ) {
      return NextResponse.json(
        { message: `Email harus berakhiran salah satu domain: ${allowedDomains.join(", ")}` },
        { status: 400 }
      );
    }

    // 🛡️ Sanitasi username
    const cleanUsername = String(username).trim();
    if (!/^[a-zA-Z0-9_-]{3,25}$/.test(cleanUsername)) {
      return NextResponse.json(
        { message: "Username harus 3-25 karakter alfanumerik (hanya boleh huruf, angka, _ dan -)" },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(String(password));
    if (passwordError) {
      return NextResponse.json(
        { message: passwordError },
        { status: 400 }
      );
    }

    
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { message: "Username sudah digunakan oleh peserta lain" },
        { status: 400 }
      );
    }

   
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let createdUserId: string | null = null;

    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: adminAuth, error: adminError } =
        await adminClient.auth.admin.createUser({
          email: lowerEmail,
          password: String(password),
          email_confirm: true,
          user_metadata: { username: cleanUsername },
        });

      if (adminError) {
        if (adminError.message.toLowerCase().includes("already registered")) {
          return NextResponse.json(
            { message: "Email sudah terdaftar" },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { message: adminError.message || "Gagal membuat akun" },
          { status: 400 }
        );
      }

      createdUserId = adminAuth.user?.id || null;
    } else {
      // Fallback ke signUp standar
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: lowerEmail,
        password: String(password),
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered")) {
          return NextResponse.json(
            { message: "Email sudah terdaftar" },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { message: authError.message || "Gagal membuat akun" },
          { status: 400 }
        );
      }

      createdUserId = authData.user?.id || null;
    }

    if (!createdUserId) {
      return NextResponse.json(
        { message: "Gagal memproses data akun pengguna" },
        { status: 500 }
      );
    }

    const { error: rpcError } = await supabase.rpc("create_profile", {
      p_id: createdUserId,
      p_username: cleanUsername,
    });

    if (rpcError) {
      console.error("create_profile error:", rpcError);
    }

    return NextResponse.json(
      { message: "Registrasi berhasil", success: true },
      { status: 200 }
    );
  } catch (err) {
    console.error("Register API error:", err);
    return NextResponse.json(
      { message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
