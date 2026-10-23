import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StoreProvider } from '../lib/store';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: 'Urlaubsplaner – Japan',
  description: 'Urlaubsplanung pro Tag: Aktivitäten als nummerierte Liste, Google-Maps-Punkte, Unterkünfte, Preise und Budget.',
  applicationName: 'Urlaubsplaner',
};

export const viewport: Viewport = { themeColor: '#0b0d12', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
