import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  ...(process.env.NEXT_EXPORT === 'true' ? { output: 'export', trailingSlash: true } : {}),
  images: { unoptimized: true },
};

export default nextConfig;
