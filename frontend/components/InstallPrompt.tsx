'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Listen for the install prompt (Chrome/Android/Edge)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a short delay so it doesn't appear immediately on load
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If iOS and not standalone, show the iOS install instructions after delay
    if (ios && !standalone) {
      const dismissed = sessionStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed
  if (isStandalone || !showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] px-4 pb-[max(env(safe-area-inset-bottom,16px),16px)]">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-accent/30 bg-surface p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        {isIOS ? (
          // iOS instructions
          <div>
            <p className="mb-2 text-sm font-bold text-white">
              Install MathNad
            </p>
            <p className="mb-3 text-xs text-gray-400">
              Tap{' '}
              <span className="inline-block rounded bg-gray-700 px-1.5 py-0.5 text-white">
                Share
              </span>{' '}
              then{' '}
              <span className="inline-block rounded bg-gray-700 px-1.5 py-0.5 text-white">
                Add to Home Screen
              </span>
            </p>
            <button
              onClick={handleDismiss}
              className="w-full rounded-xl border border-gray-700 py-2 text-xs text-gray-400 active:bg-gray-800"
            >
              Got it
            </button>
          </div>
        ) : (
          // Android/Chrome install prompt
          <div>
            <p className="mb-2 text-sm font-bold text-white">
              Install MathNad
            </p>
            <p className="mb-3 text-xs text-gray-400">
              Add to your home screen for the best experience
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-xl border border-gray-700 py-2 text-xs text-gray-400 active:bg-gray-800"
              >
                Not now
              </button>
              <button
                onClick={handleInstall}
                className="flex-1 rounded-xl bg-accent py-2 text-xs font-bold text-white active:scale-95"
              >
                Install
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
