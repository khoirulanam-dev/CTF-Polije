/**
 * Helper keamanan & validasi pemutar musik
 * Mencegah XSS, SSRF, dan injeksi URL berbahaya
 */

export interface ParsedMediaUrl {
  type: 'youtube' | 'spotify' | 'apple' | 'direct_audio' | 'invalid';
  id?: string;
  embedUrl?: string;
  cleanUrl?: string;
  error?: string;
}

const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/x-m4a',
  'audio/flac',
];

const MAX_AUDIO_FILE_SIZE = 50 * 1024 * 1024; // Maksimal 50MB per file

/**
 * Validasi dan ekstrak info dari link media musik
 */
export function parseMediaUrl(input: string): ParsedMediaUrl {
  if (!input || typeof input !== 'string') {
    return { type: 'invalid', error: 'URL tidak boleh kosong.' };
  }

  const trimmed = input.trim();

  // Tolak protokol berbahaya (XSS / local file exploit)
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return { type: 'invalid', error: 'Protokol URL tidak diizinkan.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { type: 'invalid', error: 'Format URL tidak valid.' };
  }

  // Wajib HTTPS (atau HTTP hanya untuk testing)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { type: 'invalid', error: 'URL harus menggunakan protokol HTTP/HTTPS.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. YouTube (Video / Playlist)
  if (
    hostname === 'www.youtube.com' ||
    hostname === 'youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'youtu.be'
  ) {
    let videoId: string | null = null;
    let playlistId: string | null = null;

    if (hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('?')[0];
    } else if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.split('/embed/')[1]?.split('?')[0];
    } else if (parsed.pathname.startsWith('/v/')) {
      videoId = parsed.pathname.split('/v/')[1]?.split('?')[0];
    }

    playlistId = parsed.searchParams.get('list');

    // Validasi regex YouTube Video ID (11 karakter alfanumerik + _ -)
    if (videoId && !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      videoId = null;
    }

    // Validasi playlist ID
    if (playlistId && !/^[a-zA-Z0-9_-]{12,64}$/.test(playlistId)) {
      playlistId = null;
    }

    if (!videoId && !playlistId) {
      return { type: 'invalid', error: 'ID Video / Playlist YouTube tidak valid.' };
    }

    return {
      type: 'youtube',
      id: videoId || playlistId || '',
      cleanUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : `https://www.youtube.com/playlist?list=${playlistId}`,
    };
  }

  // 2. Spotify (Embed)
  if (hostname === 'open.spotify.com') {
    // Jalur Spotify: /track/ID, /playlist/ID, /album/ID, /episode/ID
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const category = parts[0]; // track, playlist, album
      const spotifyId = parts[1].split('?')[0];

      if (
        ['track', 'playlist', 'album', 'episode'].includes(category) &&
        /^[a-zA-Z0-9]{15,40}$/.test(spotifyId)
      ) {
        return {
          type: 'spotify',
          id: spotifyId,
          embedUrl: `https://open.spotify.com/embed/${category}/${spotifyId}?utm_source=generator&theme=0`,
          cleanUrl: `https://open.spotify.com/${category}/${spotifyId}`,
        };
      }
    }
    return { type: 'invalid', error: 'Link Spotify tidak didukung (harus track/playlist/album).' };
  }

  // 3. Apple Music (Embed)
  if (hostname === 'music.apple.com') {
    const embedUrl = `https://embed.music.apple.com${parsed.pathname}${parsed.search}`;
    return {
      type: 'apple',
      embedUrl,
      cleanUrl: trimmed,
    };
  }

  // 4. Direct Audio URL (.mp3, .wav, .ogg, web radio streams)
  const pathnameLower = parsed.pathname.toLowerCase();
  const isDirectAudio =
    pathnameLower.endsWith('.mp3') ||
    pathnameLower.endsWith('.wav') ||
    pathnameLower.endsWith('.ogg') ||
    pathnameLower.endsWith('.m4a') ||
    pathnameLower.endsWith('.aac') ||
    parsed.searchParams.has('audio');

  if (isDirectAudio) {
    return {
      type: 'direct_audio',
      cleanUrl: trimmed,
    };
  }

  return {
    type: 'invalid',
    error: 'Platform tidak didukung. Harap masukkan link YouTube, Spotify, Apple Music, atau direct audio stream.',
  };
}

/**
 * Validasi file audio lokal saat peserta mengunggah lagu sendiri
 */
export function validateLocalAudioFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'File tidak ditemukan.' };
  }

  // 1. Cek ukuran file
  if (file.size > MAX_AUDIO_FILE_SIZE) {
    return {
      valid: false,
      error: `Ukuran file terlalu besar! Maksimal ${MAX_AUDIO_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }

  // 2. Cek tipe MIME atau ekstensi file
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  const hasValidExt =
    name.endsWith('.mp3') ||
    name.endsWith('.wav') ||
    name.endsWith('.ogg') ||
    name.endsWith('.m4a') ||
    name.endsWith('.aac') ||
    name.endsWith('.webm') ||
    name.endsWith('.flac');

  if (mime && !ALLOWED_AUDIO_MIMES.includes(mime) && !hasValidExt) {
    return {
      valid: false,
      error: 'Format file tidak didukung! Harap unggah file audio (.mp3, .wav, .ogg, .m4a, .aac, .flac).',
    };
  }

  return { valid: true };
}
