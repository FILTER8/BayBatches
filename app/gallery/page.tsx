'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { ethers } from 'ethers';
import { useSwipeable } from 'react-swipeable';
import { ArrowLeftCircle, ArrowRightCircle } from '@geist-ui/icons';
import Header from '../components/Header';
import { PageFooter } from '../components/PageContent';
import MemoizedNFTImage from '../components/NFTImage';
import { TokenDetail } from '../components/TokenDetail';
import { ALL_EDITIONS_QUERY } from '../graphql/queries';
import MintbayEditionAbi from '../contracts/MintbayEdition.json';

// GraphQL interfaces
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
  glyphContract: string;
}

interface GraphData {
  editions: Edition[];
}

const GLYPH_SET_ADDRESS = '0x7fe14be3b6b50bc523fac500dc3f827cd99c2b84';
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

export default function Gallery() {
  const [visibleEditions, setVisibleEditions] = useState<string[]>([]);
  const [allEditions, setAllEditions] = useState<Edition[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEditionIndex, setSelectedEditionIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Filter editions
  useEffect(() => {
    if (graphLoading || !stableGraphData?.editions || isProcessing) {
      return;
    }

    const filterEditions = async () => {
      const startTime = performance.now();
      setIsProcessing(true);
      try {
        const filtered: Edition[] = [];
        const processedIds = new Set<string>();

        for (const edition of stableGraphData.editions) {
          if (!ethers.isAddress(edition.id)) {
            console.log(`Skipping invalid edition address: ${edition.id}`);
            continue;
          }
          const editionId = edition.id.toLowerCase();
          if (processedIds.has(editionId)) {
            console.warn(`Duplicate edition detected: ${editionId}`);
            continue;
          }
          processedIds.add(editionId);

          // Use glyphContract from query, fallback to contract call
          const glyphAddress = edition.glyphContract?.toLowerCase() || (await getGlyphContractFromEdition(edition.id));
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
              glyphContract: glyphAddress,
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
          return () => timeouts.forEach(clearTimeout);
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
  }, [stableGraphData, graphLoading, isProcessing]);

  const filteredEditions = useMemo(() => allEditions, [allEditions]);
  const isLoading = graphLoading || isProcessing;

  const navigateToNextEdition = () => {
    if (selectedEditionIndex === null || filteredEditions.length === 0) return;
    const nextIndex = (selectedEditionIndex + 1) % filteredEditions.length;
    setSelectedEditionIndex(nextIndex);
  };

  const navigateToPreviousEdition = () => {
    if (selectedEditionIndex === null || filteredEditions.length === 0) return;
    const prevIndex = (selectedEditionIndex - 1 + filteredEditions.length) % filteredEditions.length;
    setSelectedEditionIndex(prevIndex);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => navigateToNextEdition(),
    onSwipedRight: () => navigateToPreviousEdition(),
    trackMouse: true,
  });

  const selectedEdition = selectedEditionIndex !== null ? filteredEditions[selectedEditionIndex] : null;

  return (
    <div className="flex flex-col min-h-screen font-sans text-[#111111] mini-app-theme bg-[#ffffff]">
      <div className="w-full max-w-md mx-auto px-4 py-3 sticky top-0 z-10 bg-[#ffffff]">
        <Header />
        <div
                  className="w-full h-11 flex items-center justify-between text-white text-sm tracking-[0.1em] mb-3 cursor-pointer bg-[#e096b6] px-4"
          onClick={() => setSelectedEditionIndex(null)}
        >
          {selectedEdition && (
            <ArrowLeftCircle
              className="w-6 h-6 text-white cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                navigateToPreviousEdition();
              }}
            />
          )}
          <span className="flex-grow text-center">GALLERY</span>
          {selectedEdition && (
            <ArrowRightCircle
              className="w-6 h-6 text-white cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                navigateToNextEdition();
              }}
            />
          )}
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
          <div {...swipeHandlers}>
            <TokenDetail edition={selectedEdition} />
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
                      onClick={() => {
                        const index = filteredEditions.findIndex((e) => e.id === edition.id);
                        setSelectedEditionIndex(index);
                      }}
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
      <PageFooter pageName="GALLERY" />
    </div>
  );
}