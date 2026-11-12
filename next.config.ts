import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@neondatabase/serverless', 'ws'],
};

export default config;
