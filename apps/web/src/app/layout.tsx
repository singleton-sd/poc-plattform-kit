import type { Metadata } from 'next';
import { Providers } from './providers';
import { ThemeInitScript } from './theme-init-script';
import { AppFooter } from '@/components/app-footer';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import './globals.css';

export const metadata: Metadata = {
  title: 'Platform Kit',
  description: 'poc-plattform-kit web',
  manifest: '/manifest.webmanifest',
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
      </body>
    </html>
  );
}
