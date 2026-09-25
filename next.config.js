/** @type {import('next').NextConfig} */
const supabaseHostname = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
).hostname;
const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(process.env.NODE_ENV !== 'production' ? ["'unsafe-eval'"] : []),
  'https://vercel.live',
];

const nextConfig = {
  compress: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: [
            "default-src 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
            "object-src 'self'",
            `script-src ${scriptSources.join(' ')} https://challenges.cloudflare.com https://accounts.google.com https://www.youtube.com https://s.ytimg.com`,
            "style-src 'self' 'unsafe-inline' https://accounts.google.com",
            "img-src 'self' data: blob: https://*.supabase.co https://avatars.githubusercontent.com https://i.ytimg.com https://*.ytimg.com https://lh3.googleusercontent.com",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live https://challenges.cloudflare.com https://accounts.google.com https://www.youtube.com",
            "frame-src 'self' blob: https://challenges.cloudflare.com https://accounts.google.com https://www.youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://embed.music.apple.com",
            "media-src 'self' blob: data: https: http:",
            "worker-src 'self' blob:",
          ].join('; ') },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHostname,
        pathname: '/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-switch',
    ],
  },
};

module.exports = nextConfig;
