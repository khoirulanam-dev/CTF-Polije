// src/app/api/register/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { email, password, username, team_token } = await req.json();

    if (!email || !password || !username || !team_token) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // 🔐 ambil token dari ENV
    const REGISTER_TOKEN = process.env.REGISTER_TOKEN;
    if (!REGISTER_TOKEN) {
      console.error("REGISTER_TOKEN is not set in environment variables");
      return NextResponse.json(
        { message: "Server misconfigured (REGISTER_TOKEN not set)" },
        { status: 500 }
      );
    }

    if (team_token !== REGISTER_TOKEN) {
      return NextResponse.json(
        { message: "Invalid team token" },
        { status: 403 }
      );
    }

    // 📧 allowed domain dari ENV, contoh:
    // REGISTER_ALLOWED_DOMAINS=@gmail.com,@student.polije.ac.id,@polije.ac.id
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
        { message: "Email is not allowed" },
        { status: 400 }
      );
    }

    // ✅ cek username unik
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (checkError) {
      console.error("check username error:", checkError);
    }

    if (existingUser) {
      return NextResponse.json(
        { message: "Username already taken" },
        { status: 400 }
      );
    }

    // ✅ daftar ke Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError?.message === "User already registered") {
      return NextResponse.json(
        { message: "Email already registered" },
        { status: 400 }
      );
    }

    if (authError || !authData.user) {
      return NextResponse.json(
        { message: authError?.message ?? "Failed to create account" },
        { status: 500 }
      );
    }

    // ✅ buat profile via RPC create_profile
    const { error: rpcError } = await supabase.rpc("create_profile", {
      p_id: authData.user.id,
      p_username: username,
    });

    if (rpcError) {
      console.error("create_profile error:", rpcError);
      return NextResponse.json(
        { message: `Failed to create user profile: ${rpcError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "OK" }, { status: 200 });
  } catch (err) {
    console.error("Register API error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
