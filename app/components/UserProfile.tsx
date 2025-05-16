'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { USER_PROFILE_QUERY } from '../graphql/queries';
import MemoizedNFTImage from './NFTImage';
import { TokenDetail } from './TokenDetail';
import { Avatar, Name } from '@coinbase/onchainkit/identity';
import { base } from 'wagmi/chains';
import { getGlyphContractFromEdition } from '../lib/contractUtils';

const GLYPH_SET_ADDRESS = '0x8A7075295bb7f8aB5dC5BdA75E0B726bB289af40';

interface Token {
  id: string;
  tokenId: string;
  edition: Edition;
}

interface Edition {
  id: string;
  glyphContract: string;
  name: string;
  totalSupply: string;
  editionSize: string;
  price: string;
  isFreeMint: boolean;
  paused: boolean;
}

interface SelectedEdition extends Edition {
  tokenId: number;
}

interface UserProfileProps {
  walletAddress: string;
}

export function UserProfile({ walletAddress }: UserProfileProps) {
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

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) return <div className="text-center">Loading...</div>;
  if (error) return <div className="text-center text-red-500">Error: {error.message}</div>;

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-[44px] z-30 flex justify-center py-1">
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
        <Avatar
          address={walletAddress as `0x${string}`}
          chain={base}
          className="w-8 h-8 rounded-full"
          onError={(error) => console.error(`Avatar error for ${walletAddress}:`, error)}
        />
        {selectedEdition ? (
          <h1
            className="text-sm font-bold cursor-pointer text-blue-500 hover:underline"
            onClick={() => setSelectedEdition(null)}
          >
            <Name
              address={walletAddress as `0x${string}`}
              chain={base}
              className="inline"
              onError={(error) => console.error(`Name error for ${walletAddress}:`, error)}
            >
              {({ name }) => (
                <span>{name || truncateAddress(walletAddress)}</span>
              )}
            </Name>
          </h1>
        ) : (
          <h1 className="text-sm font-bold">
            <Name
              address={walletAddress as `0x${string}`}
              chain={base}
              className="inline"
              onError={(error) => console.error(`Name error for ${walletAddress}:`, error)}
            >
              {({ name }) => (
                <span>{name || truncateAddress(walletAddress)}</span>
              )}
            </Name>
          </h1>
        )}
      </div>
      <section className="mt-0">
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
                          id: token.edition.id,
                          glyphContract: token.edition.glyphContract,
                          name: token.edition.name,
                          totalSupply: String(token.edition.totalSupply),
                          editionSize: String(token.edition.editionSize),
                          price: token.edition.price,
                          isFreeMint: token.edition.isFreeMint,
                          paused: token.edition.paused,
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
                    onClick={() =>
                      setSelectedEdition({
                        id: edition.id,
                        glyphContract: edition.glyphContract,
                        name: edition.name,
                        totalSupply: String(edition.totalSupply),
                        editionSize: String(edition.editionSize),
                        price: edition.price,
                        isFreeMint: edition.isFreeMint,
                        paused: edition.paused,
                        tokenId: 1,
                      })
                    }
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