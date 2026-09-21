// src/app/api/register/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// 🛡️ In-memory IP Rate Limiter: Max 5 registrasi per IP per 15 menit
type RateLimitRecord = { count: number; firstAttempt: number };
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 menit
const MAX_ATTEMPTS_PER_WINDOW = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Bersihkan record kadaluarsa secara periodik
  if (rateLimitMap.size > 2000) {
    rateLimitMap.forEach((val, key) => {
      if (now - val.firstAttempt > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    });
  }

  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstAttempt: now });
    return false;
  }

  if (record.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return true;
  }

  record.count += 1;
  return false;
}

export async function POST(req: Request) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    if (isRateLimited(ip)) {
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

    if (String(password).length < 6) {
      return NextResponse.json(
        { message: "Password minimal 6 karakter" },
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
