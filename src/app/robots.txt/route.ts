export function GET() {
  return new Response(
`User-agent: *
Allow: /

# POLIJE CTF 2025
# Hint: Tidak semua rahasia disimpan lewat HTTP...
# secret.ctfpolije.dev


`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}
