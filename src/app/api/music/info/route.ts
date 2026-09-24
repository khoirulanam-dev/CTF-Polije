import { NextRequest, NextResponse } from "next/server";

function parseISO8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  // 1. Validasi input dasar & batasi panjang (cegah ReDoS & buffer overload)
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.length > 2048) {
    return NextResponse.json({ error: "URL tidak valid atau terlalu panjang." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.trim());
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return NextResponse.json({ error: "Hanya protokol HTTP/HTTPS yang diizinkan." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Format URL tidak valid." }, { status: 400 });
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  const responseHeaders = {
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
  };

  try {
    // 2. YouTube video (Whitelisted Hostnames & Strict Regex ID)
    const isYouTubeHost =
      hostname === "www.youtube.com" ||
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "youtu.be";

    if (isYouTubeHost) {
      let videoId: string | null = null;
      if (hostname === "youtu.be") {
        videoId = parsedUrl.pathname.slice(1).split("?")[0];
      } else if (parsedUrl.pathname === "/watch") {
        videoId = parsedUrl.searchParams.get("v");
      } else if (parsedUrl.pathname.startsWith("/embed/")) {
        videoId = parsedUrl.pathname.split("/embed/")[1]?.split("?")[0];
      }

      // Validasi ketat video ID YouTube (11 karakter alphanumeric + _ -)
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

        let title = `YouTube Video (${videoId})`;
        let author = "YouTube";
        let thumbnail: string | null = null;
        let duration = 0;

        try {
          const [oembedRes, watchRes] = await Promise.all([
            fetch(oembedUrl, {
              next: { revalidate: 86400 },
              headers: { "User-Agent": "Mozilla/5.0" },
              signal: AbortSignal.timeout(4000),
            }).catch(() => null),
            fetch(watchUrl, {
              next: { revalidate: 86400 },
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
              signal: AbortSignal.timeout(4000),
            }).catch(() => null),
          ]);

          if (oembedRes && oembedRes.ok) {
            const data = await oembedRes.json();
            if (data.title && typeof data.title === "string") {
              title = data.title.slice(0, 160).trim();
            }
            if (data.author_name && typeof data.author_name === "string") {
              author = data.author_name.slice(0, 80).trim();
            }
            if (data.thumbnail_url && typeof data.thumbnail_url === "string") {
              thumbnail = data.thumbnail_url;
            }
          }

          if (watchRes && watchRes.ok) {
            const html = await watchRes.text();
            const matchMs = html.match(/"approxDurationMs":"(\d+)"/);
            const matchIso = html.match(/itemprop="duration"\s+content="([^"]+)"/);
            const matchSec = html.match(/"lengthSeconds":"(\d+)"/);

            if (matchMs && matchMs[1]) {
              const ms = parseInt(matchMs[1], 10);
              if (isFinite(ms) && ms > 0) duration = Math.floor(ms / 1000);
            } else if (matchIso && matchIso[1]) {
              duration = parseISO8601Duration(matchIso[1]);
            } else if (matchSec && matchSec[1]) {
              const sec = parseInt(matchSec[1], 10);
              if (isFinite(sec) && sec > 0) duration = sec;
            }
          }
        } catch (fetchErr) {
          console.warn("Error fetching YouTube info:", fetchErr);
        }

        return NextResponse.json(
          {
            success: true,
            title,
            author,
            thumbnail,
            duration: Math.max(0, duration),
            youtubeId: videoId,
          },
          { headers: responseHeaders }
        );
      }
    }

    // 3. Spotify Track (Whitelisted Hostname & Safe Path)
    if (hostname === "open.spotify.com") {
      const parts = parsedUrl.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && ["track", "playlist", "album", "episode"].includes(parts[0])) {
        try {
          const spotifyOembed = `https://open.spotify.com/oembed?url=https://open.spotify.com/${parts[0]}/${parts[1]}`;
          const res = await fetch(spotifyOembed, {
            next: { revalidate: 86400 },
            signal: AbortSignal.timeout(4000),
          });
          if (res.ok) {
            const data = await res.json();
            return NextResponse.json(
              {
                success: true,
                title: typeof data.title === "string" ? data.title.slice(0, 160).trim() : "Spotify Track",
                author: "Spotify",
                thumbnail: typeof data.thumbnail_url === "string" ? data.thumbnail_url : null,
              },
              { headers: responseHeaders }
            );
          }
        } catch (spotifyErr) {
          console.warn("Error fetching Spotify oEmbed:", spotifyErr);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        title: "Audio Stream",
        author: "Web Stream",
      },
      { headers: responseHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        title: "Audio Stream",
        author: "Web",
      },
      { status: 500 }
    );
  }
}
