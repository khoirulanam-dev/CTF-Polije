const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(
  token: string,
  request?: Request,
): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not configured");
    return { success: false, error: "CAPTCHA belum dikonfigurasi di server." };
  }

  if (!token || token.length > 2048) {
    return { success: false, error: "CAPTCHA wajib diselesaikan." };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    const clientIp = request?.headers.get("cf-connecting-ip")?.trim();
    if (clientIp) body.set("remoteip", clientIp);

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const result = (await response.json()) as TurnstileResponse;

    if (!response.ok || !result.success) {
      return { success: false, error: "CAPTCHA tidak valid atau sudah kedaluwarsa." };
    }

    return { success: true };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return { success: false, error: "CAPTCHA gagal diverifikasi. Coba lagi." };
  }
}
