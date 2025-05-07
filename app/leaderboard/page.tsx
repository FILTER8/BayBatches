'use client';

import { useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import { ethers } from 'ethers';
import Header from '../components/Header';
import { TitleBar, PageFooter } from '../components/PageContent';
import { Leaderboard } from '../components/Leaderboard';
import { LEADERBOARD_QUERY } from '../graphql/queries';
import { getUserProfiles } from '../lib/neynar';
import MintbayEditionAbi from '../contracts/MintbayEdition.json';

const GLYPH_SET_ADDRESS = '0x94e1f188d72970ce27c890fb9469a5bbb550e2d7';
const ALCHEMY_URL = process.env.NEXT_PUBLIC_ALCHEMY_URL || '';
const provider = ALCHEMY_URL ? new ethers.JsonRpcProvider(ALCHEMY_URL) : null;
const glyphContractCache = new Map<string, string | null>();

async function getGlyphContractFromEdition(address: string): Promise<string | null> {
  if (!provider) {
    console.error('Provider is not initialized due to missing ALCHEMY_URL');
    return null;
  }
  if (glyphContractCache.has(address)) {
    return glyphContractCache.get(address)!;
  }

  try {
    const contract = new ethers.Contract(address, MintbayEditionAbi.abi, provider);
    const glyphAddress = await contract.glyphContract();
    const result = glyphAddress.toLowerCase();
    glyphContractCache.set(address, result);
    return result;
  } catch (error) {
    console.error(`Failed to fetch glyphContract for ${address}:`, error);
    glyphContractCache.set(address, null);
    return null;
  }
}

export default function LeaderboardPage() {
  const { data, loading, error: queryError } = useQuery(LEADERBOARD_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  const [profiles, setProfiles] = useState<
    Record<string, { username: string; avatarUrl: string }>
  >({});
  const [profileError, setProfileError] = useState<string | null>(null);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);

  useEffect(() => {
    if (data) {
      console.log('Subgraph data:', JSON.stringify(data, null, 2));
      const filterUsers = async () => {
        const filtered: any[] = [];
        const processedIds = new Set<string>();

        const users = data?.users?.filter(
          (user: any) =>
            (user.tokensOwned?.length || 0) > 0 || (user.editionsCreated?.length || 0) > 0
        ) || [];

        for (const user of users) {
          const userId = user.id.toLowerCase();
          if (processedIds.has(userId)) continue;
          processedIds.add(userId);

          let tokensOwnedCount = 0;
          let editionsCreatedCount = 0;

          // Filter tokensOwned
          if (user.tokensOwned?.length > 0) {
            const tokenResults = await Promise.allSettled(
              user.tokensOwned.map(async (token: any) => {
                const glyphAddress = await getGlyphContractFromEdition(token.edition.id);
                return { token, glyphAddress };
              })
            );
            tokensOwnedCount = tokenResults.filter(
              (result: any) =>
                result.status === 'fulfilled' &&
                result.value.glyphAddress === GLYPH_SET_ADDRESS.toLowerCase()
            ).length;
          }

          // Filter editionsCreated
          if (user.editionsCreated?.length > 0) {
            const editionResults = await Promise.allSettled(
              user.editionsCreated.map(async (edition: any) => {
                const glyphAddress = await getGlyphContractFromEdition(edition.id);
                return { edition, glyphAddress };
              })
            );
            editionsCreatedCount = editionResults.filter(
              (result: any) =>
                result.status === 'fulfilled' &&
                result.value.glyphAddress === GLYPH_SET_ADDRESS.toLowerCase()
            ).length;
          }

          if (tokensOwnedCount > 0 || editionsCreatedCount > 0) {
            filtered.push({
              id: userId,
              tokensOwnedCount,
              editionsCreatedCount,
            });
          }
        }

        setFilteredUsers(filtered);

        // Fetch profiles for filtered users
        const addresses = filtered.map((user) => user.id);
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
        }
      };

      filterUsers();
    }
  }, [data]);

  const mostCollected =
    filteredUsers
      .filter((user) => user.tokensOwnedCount > 0)
      .map((user) => ({
        walletAddress: user.id,
        username: profiles[user.id]?.username || user.id.slice(0, 6),
        avatarUrl: profiles[user.id]?.avatarUrl || 'https://default-avatar.png',
        tokensOwnedCount: user.tokensOwnedCount,
        editionsCreatedCount: user.editionsCreatedCount,
      }))
      .sort((a, b) => b.tokensOwnedCount - a.tokensOwnedCount)
      .slice(0, 10) || [];

  const mostCreated =
    filteredUsers
      .filter((user) => user.editionsCreatedCount > 0)
      .map((user) => ({
        walletAddress: user.id,
        username: profiles[user.id]?.username || user.id.slice(0, 6),
        avatarUrl: profiles[user.id]?.avatarUrl || 'https://default-avatar.png',
        tokensOwnedCount: user.tokensOwnedCount,
        editionsCreatedCount: user.editionsCreatedCount,
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
        </Suspense>
        {loading ? (
          <div className="text-center">Loading...</div>
        ) : queryError ? (
          <div className="text-center text-red-500">Error: {queryError.message}</div>
        ) : profileError ? (
          <div className="text-center text-red-500">{profileError}</div>
        ) : !data?.users?.length ? (
          <div className="text-center text-gray-500">
            No users found in the subgraph
          </div>
        ) : !mostCollected.length && !mostCreated.length ? (
          <div className="text-center text-gray-500">
            No users found with tokens or editions for this glyph set
          </div>
        ) : (
          <div className="mt-2">
            <Leaderboard mostCollected={mostCollected} mostCreated={mostCreated} />
            <PageFooter pageName="LEADERBOARD" />
          </div>
        )}
      </div>
    </div>
  );
}