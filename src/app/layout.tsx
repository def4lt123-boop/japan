import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DatenProvider } from '../lib/daten';
import { Huelle } from '../components/Huelle';

export const metadata: Metadata = {
  title: {
    default: 'Reiseplan – dein digitaler Reiseassistent · made by Flo',
    template: '%s · Reiseplan',
  },
  description: 'Reisen anlegen, Tage planen, Unterkünfte und Orte auf der Karte – unterwegs auf dem Handy, zu Hause am Rechner. made by Flo',
  applicationName: 'Reiseplan',
};

export const viewport: Viewport = {
  // das startskript unten setzt die farbe der kopfleiste nach dem licht um
  themeColor: '#f4f6f9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const ANLAUF = `(function(){try{var e=JSON.parse(localStorage.getItem('reiseplan.einstellungen.v1')||'{}');var t=e&&e.thema;var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var l=(t==='hell'||t==='dunkel')?t:(d?'dunkel':'hell');var w=document.documentElement;w.setAttribute('data-thema',l);w.style.colorScheme=l;var m=document.querySelector('meta[name="theme-color"]');if(m&&l==='dunkel')m.setAttribute('content','#0e1218');}catch(a){document.documentElement.setAttribute('data-thema','hell');}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        {/* vor dem ersten bild entschieden, damit die seite nie weiß aufblitzt */}
        <script dangerouslySetInnerHTML={{ __html: ANLAUF }} />
        <DatenProvider>
          <Huelle>{children}</Huelle>
        </DatenProvider>
      </body>
    </html>
  );
}
