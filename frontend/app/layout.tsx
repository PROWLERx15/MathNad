import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import InstallPrompt from '@/components/InstallPrompt';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#836ef9',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'MathNad - PvP Math Battles on Monad',
  description:
    'Real-time competitive math battles with USDC stakes on Monad blockchain',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MathNad',
  },
  formatDetection: {
    telephone: false,
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
      <head>
        {/* PWA meta tags for iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MathNad" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* iOS splash screens - generated from icon */}
        <link rel="apple-touch-startup-image" href="/apple-touch-icon.png" />
        {/* Prevent zoom on input focus (iOS) */}
        <meta name="format-detection" content="telephone=no" />
        {/* PWA theme for Android status bar */}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={jetbrainsMono.className} suppressHydrationWarning>
        <Providers>
          {children}
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
