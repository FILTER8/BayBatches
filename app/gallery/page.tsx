'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { ethers } from 'ethers';
import confetti from 'canvas-confetti';
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi';
import Header from '../components/Header';
import NFTImage from '../components/NFTImage';
import MintbayEditionAbi from '../contracts/MintbayEdition.json';

// GraphQL query and interfaces
interface Creator {
  id: string;
}

interface Edition {
  id: string;
  name: string;
  creator: Creator;
  createdAt: string;
  palette: string;
  totalSupply: string;
  editionSize: string;
  price: string;
  isFreeMint: boolean;
  paused: boolean;
}

interface GraphData {
  editions: Edition[];
}

const GLYPH_SET_ADDRESS = '0x94e1f188d72970ce27c890fb9469a5bbb550e2d7';
const LAUNCHPAD_FEE = '0.0004';
const ALCHEMY_URL = process.env.NEXT_PUBLIC_ALCHEMY_URL || '';

const ALL_EDITIONS_QUERY = gql`
  query AllEditions {
    editions(
      first: 30
      skip: 0
      orderBy: createdAt
      orderDirection: desc
      where: { removed: false }
    ) {
      id
      name
      creator { id }
      createdAt
      palette
      totalSupply
      editionSize
      price
      isFreeMint
      paused
    }
  }
`;

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

const MemoizedNFTImage = React.memo(NFTImage, (prevProps, nextProps) => {
  return prevProps.address === nextProps.address && prevProps.tokenId === nextProps.tokenId && prevProps.alchemyUrl === nextProps.alchemyUrl;
});

export default function Gallery() {
  const [visibleEditions, setVisibleEditions] = useState<string[]>([]);
  const [allEditions, setAllEditions] = useState<Edition[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<Edition | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasFiltered, setHasFiltered] = useState(false);

  const { address: walletAddress, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: txHash, error: writeError, isPending: isWriting } = useWriteContract();

  useEffect(() => {
    if (txHash) {
      setShowCollectedOverlay(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff0000', '#00ff00', '#0000ff', '#ff69b4', '#ffd700'],
        disableForReducedMotion: true,
      });
      setTimeout(() => {
        setShowCollectedOverlay(false);
      }, 3000);
    }
  }, [txHash]);

  useEffect(() => {
    console.log('Wallet Config:', {
      apiKey: process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
      walletAddress,
    });
  }, [walletAddress]);

  const { data: graphData, loading: graphLoading, error: graphError, startPolling, stopPolling } = useQuery<GraphData>(ALL_EDITIONS_QUERY, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 60000,
  });

  useEffect(() => {
    startPolling(60000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const stableGraphData = useMemo(() => {
    if (!graphData?.editions) return null;
    console.log('GraphQL query completed at:', new Date().toISOString());
    return { editions: graphData.editions.map((e: Edition) => ({ ...e })) };
  }, [graphData]);

  useEffect(() => {
    if (graphLoading || !stableGraphData?.editions || isProcessing || hasFiltered) {
      return;
    }

    const filterEditions = async () => {
      const startTime = performance.now();
      setIsProcessing(true);
      try {
        const filtered: Edition[] = [];
        const processedIds = new Set<string>();

        const glyphResults = await Promise.allSettled(
          stableGraphData.editions.map(async (edition: Edition) => {
            if (!ethers.isAddress(edition.id)) {
              console.log(`Skipping invalid edition address: ${edition.id}`);
              return { edition, glyphAddress: null };
            }
            const editionId = edition.id.toLowerCase();
            if (processedIds.has(editionId)) {
              console.warn(`Duplicate edition detected: ${editionId}`);
              return { edition, glyphAddress: null };
            }
            processedIds.add(editionId);
            const glyphAddress = await getGlyphContractFromEdition(edition.id);
            return { edition, glyphAddress };
          })
        );

        for (const result of glyphResults) {
          if (result.status === 'rejected') {
            console.error('Glyph contract fetch failed:', result.reason);
            continue;
          }
          const { edition, glyphAddress } = result.value;
          if (!glyphAddress) continue;
          const editionId = edition.id.toLowerCase();
          if (glyphAddress === GLYPH_SET_ADDRESS.toLowerCase()) {
            filtered.push({
              id: editionId,
              name: edition.name || 'Unnamed Edition',
              creator: { id: edition.creator.id.toLowerCase() },
              createdAt: edition.createdAt,
              palette: edition.palette,
              totalSupply: edition.totalSupply,
              editionSize: edition.editionSize,
              price: edition.price,
              isFreeMint: edition.isFreeMint,
              paused: edition.paused,
            });
          }
        }

        if (filtered.length > 0) {
          setAllEditions(filtered);
          setVisibleEditions([filtered[0].id]);
          const timeouts: NodeJS.Timeout[] = [];
          filtered.slice(1).forEach((edition, index) => {
            const batchTimeout = setTimeout(() => {
              setVisibleEditions((prev) => {
                if (!prev.includes(edition.id)) {
                  return [...prev, edition.id];
                }
                return prev;
              });
            }, (index + 1) * 200);
            timeouts.push(batchTimeout);
          });
          setHasFiltered(true);
          return () => {
            timeouts.forEach(clearTimeout);
            setHasFiltered(false); // Reset hasFiltered on cleanup
          };
        }
      } catch (error) {
        console.error('Error filtering editions:', error);
        setErrorMessage('Failed to load editions.');
      } finally {
        setIsProcessing(false);
        console.log('Edition filtering completed in:', `${(performance.now() - startTime).toFixed(2)}ms`);
      }
    };

    filterEditions();
  }, [stableGraphData, graphLoading, isProcessing, hasFiltered]);

  const filteredEditions = useMemo(() => allEditions, [allEditions]);
  const isLoading = graphLoading || isProcessing;

  return (
    <div className="flex flex-col min-h-screen font-sans text-[#111111] mini-app-theme bg-[#ffffff]">
      <div className="w-full max-w-md mx-auto px-4 py-3 sticky top-0 z-10 bg-[#ffffff]">
        <Header />
        <div
          className="w-full h-11 flex items-center justify-center text-white text-sm tracking-[0.1em] mb-3 cursor-pointer"
          style={{ backgroundColor: '#e096b6' }}
          onClick={() => setSelectedEdition(null)}
        >
          GALLERY
        </div>
      </div>

      <main className="relative w-full max-w-md mx-auto px-4">
        {graphError && (
          <div className="text-sm text-red-500 text-center mb-4">
            Error loading editions: {graphError.message}
          </div>
        )}
        {errorMessage && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white p-2 rounded shadow-lg z-50">
            {errorMessage}
          </div>
        )}
        {selectedEdition ? (
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold mb-2 mt-0">{selectedEdition.name}</h2>
            <div className="w-full max-w-md mb-4 relative">
              <MemoizedNFTImage address={selectedEdition.id} tokenId={1} alchemyUrl={ALCHEMY_URL} />
              {showCollectedOverlay && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[#ffffff] text-lg font-medium">
                  collected
                </div>
              )}
            </div>
            <p className="text-sm mb-4">
              Edition: {isLoading ? 'Loading...' : `${Number(selectedEdition.totalSupply)}/${Number(selectedEdition.editionSize) || 'Open Edition'}`}
            </p>
            {isConnected ? (
              <>
                <button
                  onClick={async () => {
                    if (!isConnected) {
                      alert("Please connect your wallet first to collect an NFT.");
                      return;
                    }
                    try {
                      console.log("Switching to Base Sepolia...");
                      await switchChain({ chainId: 84532 });
                      console.log("Chain switched, preparing transaction...");
                      const baseCost = selectedEdition.isFreeMint ? 0 : Number(ethers.formatEther(selectedEdition.price));
                      const totalCost = baseCost + Number(LAUNCHPAD_FEE);
                      const totalCostWei = BigInt(Math.round(totalCost * 1e18));
                      console.log("Total cost (wei):", totalCostWei.toString());
                      console.log("Minting to contract:", selectedEdition.id);
                      console.log("Wallet address:", walletAddress);
                      await writeContract({
                        address: selectedEdition.id as `0x${string}`,
                        abi: MintbayEditionAbi.abi,
                        functionName: "collectBatch",
                        args: [BigInt(1)],
                        value: totalCostWei,
                      });
                      console.log("Transaction sent, awaiting confirmation...");
                    } catch (error) {
                      console.error("Error in handleCollect:", error);
                    }
                  }}
                  className={`w-full max-w-md py-2 px-4 text-sm tracking-[0.1em] text-[#ffffff] bg-green-500 hover:bg-green-600 border-radius-0 disabled:bg-gray-400`}
                  disabled={
                    selectedEdition.paused ||
                    Number(selectedEdition.totalSupply) >= Number(selectedEdition.editionSize) ||
                    Number(selectedEdition.editionSize) === 0 ||
                    isWriting
                  }
                >
                  {Number(selectedEdition.totalSupply) >= Number(selectedEdition.editionSize) && Number(selectedEdition.editionSize) > 0
                    ? 'sold out'
                    : selectedEdition.paused
                    ? 'paused'
                    : selectedEdition.isFreeMint
                    ? `free (${LAUNCHPAD_FEE} ETH)`
                    : `collect (${LAUNCHPAD_FEE} ETH)`}
                </button>
                {isWriting && <p className="text-xs mt-2 text-yellow-500">Minting in progress...</p>}
                {txHash && (
                  <p className="text-xs mt-2 text-green-600">
                    [Collected! Tx:{' '}
                    <a
                      href={`https://sepolia.basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-green-800"
                    >
                      {txHash.slice(0, 6)}...
                    </a>]
                  </p>
                )}
                {writeError && <p className="text-xs mt-2 text-red-500">Error: {writeError.message}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-500">Please connect your wallet to collect.</p>
            )}
            <a
              href={`https://mintbay.co/token/${selectedEdition.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 text-blue-500 hover:underline text-sm"
            >
              View on Mintbay
            </a>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center mt-4">
            <svg
              className="animate-spin h-5 w-5 text-gray-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredEditions.length === 0 ? (
              <p className="text-sm text-gray-500 col-span-2 text-center">No editions found for this glyph set</p>
            ) : (
              filteredEditions.map((edition) => (
                <div
                  key={edition.id}
                  className={`transition-opacity duration-500 ${
                    visibleEditions.includes(edition.id) ? 'opacity-100 animate-fade-in' : 'opacity-0'
                  }`}
                >
                  {visibleEditions.includes(edition.id) ? (
                    <div
                      className="cursor-pointer pointer-events-auto"
                      onClick={() => setSelectedEdition(edition)}
                    >
                      <MemoizedNFTImage address={edition.id} tokenId={1} alchemyUrl={ALCHEMY_URL} />
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}