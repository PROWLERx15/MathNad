import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MathNad - PvP Math Battles on Monad',
  description:
    'Real-time competitive math battles with USDC stakes on Monad blockchain',
  manifest: '/manifest.json',
  themeColor: '#836ef9',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-512.png',
  },
  openGraph: {
    title: 'MathNad - PvP Math Battles on Monad',
    description:
      'Real-time competitive math battles with USDC stakes on Monad blockchain',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={jetbrainsMono.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
