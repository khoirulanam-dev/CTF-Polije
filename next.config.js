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
            "frame-ancestors 'none'",
            "object-src 'none'",
            `script-src ${scriptSources.join(' ')} https://challenges.cloudflare.com`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://*.supabase.co https://avatars.githubusercontent.com",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live https://challenges.cloudflare.com",
            "frame-src 'self' https://challenges.cloudflare.com",
            "worker-src 'self' blob:",
          ].join('; ') },
          { key: 'X-Frame-Options', value: 'DENY' },
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
