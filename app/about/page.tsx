'use client';

import { Suspense } from 'react';
import Header from '../components/Header';
import { TitleBar, PageFooter } from '../components/PageContent';

export default function About() {
  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <Header />
        <Suspense
          fallback={
            <div
              className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3"
              style={{ backgroundColor: '#079153' }}
            >
              ABOUT
            </div>
          }
        >
          <TitleBar pageName="ABOUT" />
          <div className="mt-2">
            <h1 className="text-xl font-bold mb-4">About BayBatches</h1>
            <p className="text-sm">BayBatches is a platform for collecting and creating unique NFTs.</p>
          </div>
          <PageFooter pageName="ABOUT" />
        </Suspense>
      </div>
    </div>
  );
}