import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body || {};

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid userId" },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await adminClient
      .from("users")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
