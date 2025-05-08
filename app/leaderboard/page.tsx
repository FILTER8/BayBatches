'use client';

import { useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import Header from '../components/Header';
import { TitleBar, PageFooter } from '../components/PageContent';
import { Leaderboard } from '../components/Leaderboard';
import { LEADERBOARD_QUERY } from '../graphql/queries';
import { getUserProfiles } from '../lib/neynar';

interface Token {
  id: string;
}

interface Edition {
  id: string;
}

interface User {
  id: string;
  tokensOwned: Token[];
  editionsCreated: Edition[];
}

interface Profile {
  username: string;
  avatarUrl: string;
}

interface LeaderboardEntry {
  walletAddress: string;
  username: string;
  avatarUrl: string;
  tokensOwnedCount: number;
  editionsCreatedCount: number;
}

export default function LeaderboardPage() {
  const { data, loading, error: queryError } = useQuery<{ users: User[] }>(LEADERBOARD_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      console.log('Subgraph data:', JSON.stringify(data, null, 2));
      const addresses = data.users
        .filter(
          (user) => (user.tokensOwned?.length || 0) > 0 || (user.editionsCreated?.length || 0) > 0
        )
        .map((user) => user.id);
      console.log('Filtered addresses for profiles:', addresses);
      if (addresses.length > 0) {
        getUserProfiles(addresses)
          .then((profiles) => {
            console.log('Fetched profiles:', JSON.stringify(profiles, null, 2));
            setProfiles(profiles);
          })
          .catch((err) => {
            console.error('Failed to fetch profiles:', err);
            setProfileError('Failed to load user profiles');
          });
      } else {
        console.log('No users with tokens or editions found');
      }
    }
  }, [data]);

  const mostCollected: LeaderboardEntry[] =
    data?.users
      .filter((user) => (user.tokensOwned?.length || 0) > 0)
      .map((user) => ({
        walletAddress: user.id,
        username: profiles[user.id]?.username || user.id.slice(0, 6),
        avatarUrl: profiles[user.id]?.avatarUrl || 'https://bay-batches.vercel.app/splashicon.png',
        tokensOwnedCount: user.tokensOwned?.length || 0,
        editionsCreatedCount: user.editionsCreated?.length || 0,
      }))
      .sort((a, b) => b.tokensOwnedCount - a.tokensOwnedCount)
      .slice(0, 10) || [];

  const mostCreated: LeaderboardEntry[] =
    data?.users
      .filter((user) => (user.editionsCreated?.length || 0) > 0)
      .map((user) => ({
        walletAddress: user.id,
        username: profiles[user.id]?.username || user.id.slice(0, 6),
        avatarUrl: profiles[user.id]?.avatarUrl || 'https://bay-batches.vercel.app/splashicon.png',
        tokensOwnedCount: user.tokensOwned?.length || 0,
        editionsCreatedCount: user.editionsCreated?.length || 0,
      }))
      .sort((a, b) => b.editionsCreatedCount - a.editionsCreatedCount)
      .slice(0, 10) || [];

  console.log('Most Collected:', JSON.stringify(mostCollected, null, 2));
  console.log('Most Created:', JSON.stringify(mostCreated, null, 2));

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        <Header />
        <Suspense
          fallback={
            <div
              className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3"
              style={{ backgroundColor: '#ff5f11' }}
            >
              LEADERBOARD
            </div>
          }
        >
          <TitleBar pageName="LEADERBOARD" />
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : queryError ? (
            <div className="text-center text-red-500">Error: {queryError.message}</div>
          ) : profileError ? (
            <div className="text-center text-red-500">{profileError}</div>
          ) : !data?.users?.length ? (
            <div className="text-center text-gray-500">No users found in the subgraph</div>
          ) : !mostCollected.length && !mostCreated.length ? (
            <div className="text-center text-gray-500">No users found with tokens or editions</div>
          ) : (
            <div className="mt-2">
              <Leaderboard mostCollected={mostCollected} mostCreated={mostCreated} />
              <PageFooter pageName="LEADERBOARD" />
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}