'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5">
      <div className="text-center">
        <div className="mb-4 text-5xl">📡</div>
        <h1 className="mb-2 text-2xl font-black text-white">
          You&apos;re Offline
        </h1>
        <p className="mb-6 text-sm text-gray-400">
          MathNad needs an internet connection for live battles.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-2xl bg-accent px-8 py-3 text-sm font-bold text-white active:scale-95"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
