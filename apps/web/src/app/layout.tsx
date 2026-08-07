import type { Metadata } from 'next';
import Script from 'next/script';
import { Providers } from './providers';
import { ThemeInitScript } from './theme-init-script';
import { AppFooter } from '@/components/app-footer';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import './globals.css';

export const metadata: Metadata = {
  title: 'Platform Kit',
  description: 'Multi-tenant platform foundations for Singleton SD',
  manifest: '/manifest.webmanifest',
  other: {
    // Set at deploy/runtime (SWA / env bridge). Do not commit real connection strings.
    'applicationinsights-connection-string': '',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ThemeInitScript />
      </head>
      <body className="flex min-h-screen flex-col">
        <div className="flex-1">
          <Providers>{children}</Providers>
        </div>
        <AppFooter />
        <ServiceWorkerRegister />
        <Script src="/telemetry.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
