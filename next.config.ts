import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root: there is a stray lockfile in the home directory
  // that Turbopack would otherwise pick as the root.
  turbopack: { root: __dirname },
};

export default nextConfig;
