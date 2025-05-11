'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

interface LeaderboardEntry {
  walletAddress: string;
  username: string;
  avatarUrl: string;
  basename: string | null;
  tokensOwnedCount: number;
  editionsCreatedCount: number;
}

interface LeaderboardProps {
  mostCollected: LeaderboardEntry[];
  mostCreated: LeaderboardEntry[];
}

export function Leaderboard({ mostCollected, mostCreated }: LeaderboardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'collected' | 'created'>('collected');

  const entries = tab === 'collected' ? mostCollected : mostCreated;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[40px] z-30 flex justify-center">
        <button
          onClick={() => setTab('collected')}
          className="w-full h-11 flex items-center justify-center text-sm"
          style={{
            backgroundColor: tab === 'collected' ? '#118bcb' : '#e6e6e6',
            color: tab === 'collected' ? '#ffffff' : '#000000',
          }}
        >
          Most Collected
        </button>
        <button
          onClick={() => setTab('created')}
          className="w-full h-11 flex items-center justify-center text-sm"
          style={{
            backgroundColor: tab === 'created' ? '#118bcb' : '#e6e6e6',
            color: tab === 'created' ? '#ffffff' : '#000000',
          }}
        >
          Most Created
        </button>
      </div>
      <div className="grid gap-2">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center">No data available</p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.walletAddress}
              className="flex items-center gap-2 p-2 w-full h-11 border border-gray-300 cursor-pointer hover:bg-gray-100"
              onClick={() => router.push(`/user/${entry.walletAddress}`)}
            >
              <span className="text-sm font-bold w-6">{`${index + 1}.`}</span>
              <Image
                src={entry.avatarUrl || 'https://default-avatar.png'}
                alt={entry.basename || entry.username || entry.walletAddress}
                width={32}
                height={32}
                className="rounded-full"
                unoptimized
              />
              <span className="text-sm font-medium truncate">
                {entry.basename || entry.username || entry.walletAddress.slice(0, 6)}
              </span>
              <span className="text-sm ml-auto">
                {tab === 'collected'
                  ? `${entry.tokensOwnedCount} tokens`
                  : `${entry.editionsCreatedCount} editions`}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}