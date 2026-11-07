import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DatenProvider } from '../lib/daten';
import { Huelle } from '../components/Huelle';

export const metadata: Metadata = {
  title: {
    default: 'Reiseplan – dein digitaler Reiseassistent',
    template: '%s · Reiseplan',
  },
  description: 'Reisen anlegen, Tage planen, Unterkünfte und Orte auf der Karte – unterwegs auf dem Handy, zu Hause am Rechner.',
  applicationName: 'Reiseplan',
};

export const viewport: Viewport = {
  themeColor: '#f4f6f9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <DatenProvider>
          <Huelle>{children}</Huelle>
        </DatenProvider>
      </body>
    </html>
  );
}
