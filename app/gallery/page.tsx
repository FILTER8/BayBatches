'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { ethers } from 'ethers';
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
  TransactionToast,
  TransactionToastIcon,
  TransactionToastLabel,
  TransactionToastAction,
  TransactionError,
  TransactionResponse,
} from '@coinbase/onchainkit/transaction';
import { useAccount, useConnect, useChainId } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import { LogIn } from '@geist-ui/icons';
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
      first: 20
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

// BigInt serializer for JSON.stringify
const serializeBigInt = (key: string, value: unknown | bigint) =>
  typeof value === 'bigint' ? value.toString() : value;

export default function Gallery() {
  const [visibleEditions, setVisibleEditions] = useState<string[]>([]);
  const [allEditions, setAllEditions] = useState<Edition[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState<Edition | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasFiltered, setHasFiltered] = useState(false);
  const [showCollectedOverlay, setShowCollectedOverlay] = useState(false);

  const { address: walletAddress } = useAccount();
  const chainId = useChainId();
  const { connect } = useConnect();

  // Debug config
  useEffect(() => {
    console.log('Wallet Config:', {
      apiKey: process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
      chainId,
      walletAddress,
    });
  }, [walletAddress, chainId]);

  const { data: graphData, loading: graphLoading, error: graphError } = useQuery<GraphData>(ALL_EDITIONS_QUERY, {
    fetchPolicy: 'network-only',
  });

  const stableGraphData = useMemo(() => {
    if (!graphData?.editions) return null;
    return { editions: graphData.editions.map((e: Edition) => ({ ...e })) };
  }, [graphData]);

  // Filter editions
  useEffect(() => {
    if (graphLoading || !stableGraphData?.editions || isProcessing || hasFiltered) {
      return;
    }

    const filterEditions = async () => {
      setIsProcessing(true);
      try {
        const filtered: Edition[] = [];
        const processedIds = new Set<string>();

        const glyphAddresses = await Promise.all(
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

        for (const { edition, glyphAddress } of glyphAddresses) {
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
          filtered.slice(1).forEach((edition, index) => {
            setTimeout(() => {
              setVisibleEditions((prev) => [...prev, edition.id]);
            }, (index + 1) * 200);
          });
          setHasFiltered(true);
        }
      } catch (error) {
        console.error('Error filtering editions:', error);
        setErrorMessage('Failed to load editions.');
      } finally {
        setIsProcessing(false);
      }
    };

    filterEditions();
  }, [stableGraphData, graphLoading, isProcessing, hasFiltered]);

  // Mint transaction
  const getMintCall = useCallback(
    async (edition: Edition) => {
      if (!walletAddress || !ethers.isAddress(walletAddress) || !provider) {
        console.log('Invalid mint call: walletAddress=', walletAddress, 'provider=', !!provider);
        return [];
      }

      console.log('Generating mint call for edition:', edition.id, 'wallet:', walletAddress);
      const baseCostEther = edition.isFreeMint ? '0' : ethers.formatEther(edition.price);
      const feeCostEther = LAUNCHPAD_FEE;
      const totalValueWei = ethers.parseEther((Number(baseCostEther) + Number(feeCostEther)).toString());

      // Encode collectBatch call
      let data: `0x${string}` = '0x';
      try {
        const contractInterface = new ethers.Interface(MintbayEditionAbi.abi);
        data = contractInterface.encodeFunctionData('collectBatch', [BigInt(1)]) as `0x${string}`;
        console.log('Encoded data:', data);
      } catch (error) {
        console.error('Failed to encode collectBatch call:', error);
        return [];
      }

      // Estimate gas
      let gasLimit = BigInt(200000); // Default gas limit
      try {
        const contract = new ethers.Contract(edition.id, MintbayEditionAbi.abi, provider);
        const gasEstimate = await contract.collectBatch.estimateGas(BigInt(1), { value: totalValueWei });
        gasLimit = gasEstimate * BigInt(12) / BigInt(10); // Add 20% buffer
        console.log('Estimated gas limit:', gasLimit.toString());
      } catch (error) {
        console.error('Gas estimation failed:', error);
      }

      const call = [
        {
          to: edition.id as `0x${string}`,
          data,
          value: totalValueWei,
        },
      ];
      console.log('Mint call:', JSON.stringify(call, serializeBigInt, 2));
      return call;
    },
    [walletAddress]
  );

  const handleMintSuccess = useCallback(
    async (response: TransactionResponse, edition: Edition) => {
      console.log('Mint success:', response);
      const transactionHash = response.transactionReceipts[0].transactionHash;
      setErrorMessage(null);
      setShowCollectedOverlay(true);
      setTimeout(() => {
        setShowCollectedOverlay(false);
        setSelectedEdition(null);
      }, 3000);
      alert(`Mint Successful! You minted ${edition.name}! Tx: ${transactionHash}`);
    },
    []
  );

  const handleMintError = useCallback((error: TransactionError) => {
    console.error('Transaction error:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    let message = 'Transaction failed!';
    if (error.message.includes('NotWhitelisted')) {
      message = 'You need a token from a whitelisted contract to mint!';
    } else if (error.message.includes('InsufficientPayment')) {
      message = 'Insufficient ETH sent for minting!';
    } else if (error.message.includes('Exceeds max batch size')) {
      message = 'Cannot mint more than one NFT at a time.';
    } else if (error.message.includes('Exceeds max mint')) {
      message = 'You have reached the maximum mint limit for this wallet.';
    } else if (error.message.includes('chain')) {
      message = 'Please ensure your wallet is connected to Base Sepolia.';
    } else if (error.message.includes('gas')) {
      message = 'Gas estimation failed. Please try again.';
    }
    setErrorMessage(message);
  }, []);

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
            {walletAddress && ethers.isAddress(walletAddress) ? (
              <Transaction
                calls={getMintCall(selectedEdition)}
                onSuccess={(response) => handleMintSuccess(response, selectedEdition)}
                onError={handleMintError}
              >
                <TransactionButton
                  className={`w-full max-w-md py-2 px-4 text-sm tracking-[0.1em] text-[#ffffff] bg-green-500 border-radius-0 disabled:bg-gray-400`}
                  disabled={
                    selectedEdition.paused ||
                    Number(selectedEdition.totalSupply) >= Number(selectedEdition.editionSize) ||
                    Number(selectedEdition.editionSize) === 0
                  }
                  text={
                    Number(selectedEdition.totalSupply) >= Number(selectedEdition.editionSize) && Number(selectedEdition.editionSize) > 0
                      ? 'sold out'
                      : selectedEdition.paused
                      ? 'paused'
                      : selectedEdition.isFreeMint
                      ? ' collect (0.0004 ETH)'
                      : `collect (${LAUNCHPAD_FEE} ETH)`
                  }
                />
                <TransactionStatus>
                  <TransactionStatusAction />
                  <TransactionStatusLabel />
                </TransactionStatus>
                <TransactionToast className="mb-4">
                  <TransactionToastIcon />
                  <TransactionToastLabel />
                  <TransactionToastAction />
                </TransactionToast>
              </Transaction>
            ) : (
         <button
  onClick={() => connect({ connector: coinbaseWallet({ appName: 'BayBatches' }) })}
  className="w-full max-w-md py-2 px-4 flex items-center justify-center text-sm tracking-[0.1em] text-[#ffffff] bg-blue-500 rounded-none"
>
  <LogIn className="w-4 h-4 text-[#ffffff] mr-2" />
  connect wallet
</button>
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