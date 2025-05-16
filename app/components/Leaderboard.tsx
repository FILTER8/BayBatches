'use client';

import { useRouter } from 'next/navigation';
import { useState, ReactNode } from 'react';
import { Avatar, Name } from '@coinbase/onchainkit/identity';
import { base } from 'wagmi/chains';

interface LeaderboardEntry {
  walletAddress: string;
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

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
              onClick={() => {
                console.log(`Navigating to user: ${entry.walletAddress}`);
                router.push(`/user/${entry.walletAddress}`);
              }}
            >
              <span className="text-sm font-medium w-6">{index + 1}.</span>
              <div className="flex items-center gap-2">
                <Avatar
                  address={entry.walletAddress as `0x${string}`}
                  chain={base}
                  className="w-8 h-8 rounded-full"
                  onError={(error) => console.error(`Avatar error for ${entry.walletAddress}:`, error)}
                />
                <Name
                  address={entry.walletAddress as `0x${string}`}
                  chain={base}
                  className="text-sm font-medium truncate"
                  onError={(error) => console.error(`Name error for ${entry.walletAddress}:`, error)}
                >
                  {({ name }: { name: string | null }): ReactNode => (
                    <span className="text-sm font-medium truncate">
                      {name || truncateAddress(entry.walletAddress)}
                    </span>
                  )}
                </Name>
              </div>
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