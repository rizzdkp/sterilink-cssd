import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Driver SQLite memakai modul native, jadi tidak ikut di-bundle.
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],
  poweredByHeader: false,
  // Lencana dev menutupi slot fasilitas di kiri bawah.
  devIndicators: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
