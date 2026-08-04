/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static SPA export for Azure Static Web Apps -- routing is handled
  // client-side via staticwebapp.config.json's navigationFallback.
  output: 'export',
  reactStrictMode: true,
  images: {
    unoptimized: true, // static export can't use the Next.js Image loader
  },
};

export default nextConfig;
