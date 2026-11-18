import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// DESIGN.md menetapkan NotionInter bila berlisensi, dengan Inter sebagai pengganti
// sah. Inter dipakai karena angka tabularnya menjaga kode batch dan jam sejajar.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Antrean Kerja', template: '%s | SIMRS CSSD' },
  description: 'Modul Instalasi Sterilisasi Sentral: antrean batch, bukti pemantauan dan pelacakan paket.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f9f9f8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
