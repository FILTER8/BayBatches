// app/components/PageContent.tsx
'use client';

import { FC } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './DemoComponents';
import { Twitter } from '@geist-ui/icons';
import { useOpenUrl } from '@coinbase/onchainkit/minikit';

interface PageContentProps {
  pageName: 'CREATE' | 'GALLERY' | 'LEADERBOARD' | 'ABOUT';
}

export const TitleBar: FC<PageContentProps> = ({ pageName }) => {
  const router = useRouter();

  const titleBarColor =
    pageName === 'CREATE' ? '#0052ff' :
    pageName === 'GALLERY' ? '#e096b6' :
    pageName === 'ABOUT' ? '#079153' :
    '#ff5f11';

  return (
    <div
      className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3 cursor-pointer"
      style={{ backgroundColor: titleBarColor }}
      onClick={() => router.push('/')}
    >
      {pageName}
    </div>
  );
};

export const PageFooter: FC = () => { // Remove pageName prop
  const openUrl = useOpenUrl();

  return (
    <footer className="mt-2 pt-4 flex flex-col items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="text-[var(--ock-text-foreground-muted)] text-xs"
        onClick={() => openUrl('https://www.mintbay.co/')}
      >
        [visit mintbay]
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-[var(--ock-text-foreground-muted)] text-xs"
        onClick={() => openUrl('https://x.com/mintbay_co')}
        icon={<Twitter className="w-4 h-4" />}
      />
    </footer>
  );
};