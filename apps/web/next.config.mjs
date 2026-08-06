import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static SPA export for Azure Static Web Apps -- routing is handled
  // client-side via staticwebapp.config.json's navigationFallback.
  output: 'export',
  reactStrictMode: true,
  images: {
    unoptimized: true, // static export can't use the Next.js Image loader
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;
