import type { NextConfig } from 'next';

const nextConfig: NextConfig =
  process.env.DEPLOY_TARGET === 'tencent' ? { output: 'export' as const } : {};

export default nextConfig;
