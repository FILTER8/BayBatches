'use client';

import { useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import Header from '../components/Header';
import { TitleBar, PageFooter } from '../components/PageContent';
import { Leaderboard } from '../components/Leaderboard';
import { LEADERBOARD_QUERY } from '../graphql/queries';
import { getGlyphContractFromEdition } from '../lib/contractUtils';

const GLYPH_SET_ADDRESS = '0x8A7075295bb7f8aB5dC5BdA75E0B726bB289af40';

interface Token {
  id: string;
  tokenId: string;
  edition: { id: string; glyphContract: { id: string } };
}

interface Edition {
  id: string;
  glyphContract: { id: string };
}

interface User {
  id: string;
  tokensOwned: Token[];
  editionsCreated: Edition[];
}

interface LeaderboardEntry {
  walletAddress: string;
  tokensOwnedCount: number;
  editionsCreatedCount: number;
}

export default function LeaderboardPage() {
  const { data, loading, error: queryError } = useQuery<{ users: User[] }>(LEADERBOARD_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  const [filteredUsers, setFilteredUsers] = useState<
    Array<{
      id: string;
      tokensOwnedCount: number;
      editionsCreatedCount: number;
    }>
  >([]);

  useEffect(() => {
    if (data) {
      console.log('Subgraph data:', JSON.stringify(data, null, 2));

      const filterData = async () => {
        const filtered = await Promise.all(
          data.users.map(async (user) => {
            let filteredTokensOwned: Token[] = [];
            if (user.tokensOwned?.length > 0) {
              const tokenResults = await Promise.allSettled(
                user.tokensOwned.map(async (token) => {
                  const glyphAddress = token.edition.glyphContract?.id?.toLowerCase() || (await getGlyphContractFromEdition(token.edition.id));
                  return { token, glyphAddress };
                })
              );
              filteredTokensOwned = tokenResults
                .filter(
                  (result): result is PromiseFulfilledResult<{ token: Token; glyphAddress: string }> =>
                    result.status === 'fulfilled' &&
                    result.value.glyphAddress === GLYPH_SET_ADDRESS.toLowerCase() &&
                    Number(result.value.token.tokenId) !== 1 // Exclude tokenId: 1
                )
                .map((result) => result.value.token);
            }

            let filteredEditionsCreated: Edition[] = [];
            if (user.editionsCreated?.length > 0) {
              const editionResults = await Promise.allSettled(
                user.editionsCreated.map(async (edition) => {
                  const glyphAddress = edition.glyphContract?.id?.toLowerCase() || (await getGlyphContractFromEdition(edition.id));
                  return { edition, glyphAddress };
                })
              );
              filteredEditionsCreated = editionResults
                .filter(
                  (result): result is PromiseFulfilledResult<{ edition: Edition; glyphAddress: string }> =>
                    result.status === 'fulfilled' &&
                    result.value.glyphAddress === GLYPH_SET_ADDRESS.toLowerCase()
                )
                .map((result) => result.value.edition);
            }

            return {
              id: user.id,
              tokensOwnedCount: filteredTokensOwned.length,
              editionsCreatedCount: filteredEditionsCreated.length,
            };
          })
        );
        setFilteredUsers(filtered);
      };

      filterData();
    }
  }, [data]);

  const mostCollected: LeaderboardEntry[] =
    filteredUsers
      .filter((user) => user.tokensOwnedCount > 0)
      .map((user) => ({
        walletAddress: user.id,
        tokensOwnedCount: user.tokensOwnedCount,
        editionsCreatedCount: user.editionsCreatedCount,
      }))
      .sort((a, b) => b.tokensOwnedCount - a.tokensOwnedCount)
      .slice(0, 10) || [];

  const mostCreated: LeaderboardEntry[] =
    filteredUsers
      .filter((user) => user.editionsCreatedCount > 0)
      .map((user) => ({
        walletAddress: user.id,
        tokensOwnedCount: user.tokensOwnedCount,
        editionsCreatedCount: user.editionsCreatedCount,
      }))
      .sort((a, b) => b.editionsCreatedCount - a.editionsCreatedCount)
      .slice(0, 10) || [];

  console.log('Most Collected:', JSON.stringify(mostCollected, null, 2));
  console.log('Most Created:', JSON.stringify(mostCreated, null, 2));

  return (
    <div className="flex flex-col min-h-screen font-sans text-[#111111] mini-app-theme bg-[#ffffff]">
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