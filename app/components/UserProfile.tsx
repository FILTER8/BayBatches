// app/components/UserProfile.tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { ethers } from 'ethers';
import { USER_PROFILE_QUERY } from '../graphql/queries';
import MemoizedNFTImage from './NFTImage';
import { TokenDetail } from './TokenDetail';
import MintbayEditionAbi from '../contracts/MintbayEdition.json';
import Image from 'next/image'; // Added for avatar

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

interface Token {
  id: string;
  tokenId: string;
  edition: {
    id: string;
  };
}

interface Edition {
  id: string;
}

interface SelectedEdition extends Edition {
  tokenId: number;
}

interface UserProfileProps {
  walletAddress: string;
  username: string;
  avatarUrl: string;
}

export function UserProfile({ walletAddress, username, avatarUrl }: UserProfileProps) {
  const [tab, setTab] = useState<'collected' | 'created'>('collected');
  const [selectedEdition, setSelectedEdition] = useState<SelectedEdition | null>(null);
  const { data, loading, error } = useQuery<{ user: { tokensOwned: Token[]; editionsCreated: Edition[] } }>(
    USER_PROFILE_QUERY,
    {
      variables: { id: walletAddress.toLowerCase() },
      fetchPolicy: 'cache-and-network',
    }
  );
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);
  const [filteredEditions, setFilteredEditions] = useState<Edition[]>([]);

  useEffect(() => {
    if (data?.user) {
      const filterData = async () => {
        const { tokensOwned, editionsCreated } = data.user;

        // Filter tokensOwned, excluding tokenId #1
        let filteredTokensOwned: Token[] = [];
        if (tokensOwned?.length > 0) {
          const tokenResults = await Promise.allSettled(
            tokensOwned.map(async (token: Token) => {
              const glyphAddress = await getGlyphContractFromEdition(token.edition.id);
              return { token, glyphAddress };
            })
          );
          filteredTokensOwned = tokenResults
            .filter(
              (result): result is PromiseFulfilledResult<{ token: Token; glyphAddress: string }> =>
                result.status === 'fulfilled' &&
                result.value.glyphAddress === GLYPH_SET_ADDRESS.toLowerCase() &&
                Number(result.value.token.tokenId) !== 1
            )
            .map((result) => result.value.token);
        }

        // Filter editionsCreated
        let filteredEditionsCreated: Edition[] = [];
        if (editionsCreated?.length > 0) {
          const editionResults = await Promise.allSettled(
            editionsCreated.map(async (edition: Edition) => {
              const glyphAddress = await getGlyphContractFromEdition(edition.id);
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

        setFilteredTokens(filteredTokensOwned);
        setFilteredEditions(filteredEditionsCreated);
      };

      filterData();
    }
  }, [data]);

  if (loading) return <div className="text-center">Loading...</div>;
  if (error) return <div className="text-center text-red-500">Error: {error.message}</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[44px] z-30 flex justify-center py-1 bg-white">
        <button
          onClick={() => {
            setTab('collected');
            setSelectedEdition(null);
          }}
          className="w-full h-11 flex items-center justify-center text-sm"
          style={{
            backgroundColor: tab === 'collected' ? '#118bcb' : '#e6e6e6',
            color: tab === 'collected' ? '#ffffff' : '#000000',
          }}
        >
          Collected
        </button>
        <button
          onClick={() => {
            setTab('created');
            setSelectedEdition(null);
          }}
          className="w-full h-11 flex items-center justify-center text-sm"
          style={{
            backgroundColor: tab === 'created' ? '#118bcb' : '#e6e6e6',
            color: tab === 'created' ? '#ffffff' : '#000000',
          }}
        >
          Created
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Image
          src={avatarUrl || 'https://default-avatar.png'}
          alt={username}
          width={48}
          height={48}
          className="rounded-full"
          unoptimized
        />
        {selectedEdition ? (
          <h1
            className="text-xl font-bold cursor-pointer text-blue-500 hover:underline"
            onClick={() => setSelectedEdition(null)}
          >
            {username}
          </h1>
        ) : (
          <h1 className="text-xl font-bold">{username}</h1>
        )}
      </div>
      <section className="mt-2">
        {tab === 'collected' ? (
          selectedEdition ? (
            <TokenDetail edition={selectedEdition} tokenId={selectedEdition.tokenId} />
          ) : (
            <>
              {filteredTokens.length === 0 ? (
                <p className="text-sm text-gray-500">No tokens collected</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredTokens.map((token: Token) => (
                    <div
                      key={token.id}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedEdition({
                          ...token.edition,
                          tokenId: Number(token.tokenId),
                        })
                      }
                    >
                      <MemoizedNFTImage
                        address={token.edition.id}
                        tokenId={Number(token.tokenId)}
                        alchemyUrl={process.env.NEXT_PUBLIC_ALCHEMY_URL}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        ) : selectedEdition ? (
          <TokenDetail edition={selectedEdition} tokenId={selectedEdition.tokenId} />
        ) : (
          <>
            {filteredEditions.length === 0 ? (
              <p className="text-sm text-gray-500">No editions created</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredEditions.map((edition: Edition) => (
                  <div
                    key={edition.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedEdition({ ...edition, tokenId: 1 })}
                  >
                    <MemoizedNFTImage
                      address={edition.id}
                      tokenId={1}
                      alchemyUrl={process.env.NEXT_PUBLIC_ALCHEMY_URL}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}