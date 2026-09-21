/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'aylbpzcohwuvnhiemtly.supabase.co',
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
